import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname, posix } from 'path';
import { Prisma } from '@prisma/client';

import { storageConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE_CLIENT } from './storage.constants';
import type { ObjectStorageClient } from './storage.types';

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(storageConfig.KEY)
    private readonly storageConfiguration: ConfigType<typeof storageConfig>,
    @Inject(OBJECT_STORAGE_CLIENT)
    private readonly objectStorageClient: ObjectStorageClient,
  ) {}

  async uploadFile(
    file: Express.Multer.File | undefined,
    uploadedByUserId: string,
    namespace: string,
  ): Promise<Prisma.FileObjectGetPayload<Record<string, never>>> {
    if (!file) {
      throw new BadRequestException('A file upload is required.');
    }

    const extension = extname(file.originalname || '').toLowerCase();
    const objectKey = posix.join(namespace, `${randomUUID()}${extension}`);

    await this.objectStorageClient.uploadObject({
      body: file.buffer,
      contentType: file.mimetype || 'application/octet-stream',
      objectKey,
    });

    return this.prisma.fileObject.create({
      data: {
        bucket: this.storageConfiguration.bucket,
        objectKey,
        originalFilename: file.originalname || null,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        uploadedByUserId,
      },
    });
  }
}
