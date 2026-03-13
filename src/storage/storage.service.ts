import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { mkdir, writeFile } from 'fs/promises';
import { extname, join } from 'path';
import { Prisma } from '@prisma/client';

import { storageConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(storageConfig.KEY)
    private readonly storageConfiguration: ConfigType<typeof storageConfig>,
  ) {}

  async uploadFile(
    file: Express.Multer.File | undefined,
    uploadedByUserId: string,
    namespace: string,
  ): Promise<Prisma.FileObjectGetPayload<Record<string, never>>> {
    if (!file) {
      throw new BadRequestException('A file upload is required.');
    }

    if (this.storageConfiguration.driver !== 'local') {
      throw new BadRequestException(
        'Only the local storage driver is enabled in Phase 2.',
      );
    }

    const localDir = this.storageConfiguration.localDir;
    const extension = extname(file.originalname || '').toLowerCase();
    const objectKey = join(namespace, `${randomUUID()}${extension}`);
    const absolutePath = join(process.cwd(), localDir, objectKey);

    await mkdir(join(process.cwd(), localDir, namespace), {
      recursive: true,
    });
    await writeFile(absolutePath, file.buffer);

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
