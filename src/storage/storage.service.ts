import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname, posix } from 'path';
import { Prisma } from '@prisma/client';

import { appConfig, storageConfig } from '../config';
import { PrismaService } from '../prisma/prisma.service';
import { OBJECT_STORAGE_CLIENT } from './storage.constants';
import type { ObjectStorageClient } from './storage.types';

/** Minimal shape needed to compute + attach a public URL. */
export type SerializableFile = {
  id: string;
  bucket: string;
  objectKey: string;
  originalFilename: string | null;
  mimeType: string;
  sizeBytes: number;
  uploadedByUserId: string | null;
  createdAt: Date;
  updatedAt?: Date;
};

@Injectable()
export class StorageService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(storageConfig.KEY)
    private readonly storageConfiguration: ConfigType<typeof storageConfig>,
    @Inject(appConfig.KEY)
    private readonly appConfiguration: ConfigType<typeof appConfig>,
    @Inject(OBJECT_STORAGE_CLIENT)
    private readonly objectStorageClient: ObjectStorageClient,
  ) {}

  // MARK: - Upload

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

  // MARK: - URL resolution

  /**
   * Computes the public HTTP URL for a stored object.
   *
   * Priority:
   *  1. STORAGE_PUBLIC_URL env var  → "{publicUrl}/{objectKey}"
   *  2. S3 with custom endpoint     → "{endpoint}/{bucket}/{objectKey}"  (path-style)
   *                                   "{endpoint}/{objectKey}"            (virtual-hosted)
   *  3. AWS S3 (no custom endpoint) → "https://{bucket}.s3.{region}.amazonaws.com/{objectKey}"
   *  4. Local driver                → "{APP_BASE_URL}/uploads/{objectKey}"
   */
  getFileUrl(objectKey: string): string {
    const cfg = this.storageConfiguration;

    if (cfg.publicUrl) {
      return `${cfg.publicUrl.replace(/\/$/, '')}/${objectKey}`;
    }

    if (cfg.driver === 's3') {
      if (cfg.endpoint) {
        const base = cfg.endpoint.replace(/\/$/, '');
        return cfg.forcePathStyle
          ? `${base}/${cfg.bucket}/${objectKey}`
          : `${base}/${objectKey}`;
      }
      return `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com/${objectKey}`;
    }

    // Local: served by express.static middleware at /uploads
    const base = this.appConfiguration.appBaseUrl.replace(/\/$/, '');
    return `${base}/uploads/${objectKey}`;
  }

  /**
   * Returns the file object with a computed `url` field appended.
   * Use this whenever serializing a FileObject for an API response.
   */
  serializeFile(file: SerializableFile): Record<string, unknown> {
    return {
      id: file.id,
      objectKey: file.objectKey,
      mimeType: file.mimeType,
      sizeBytes: file.sizeBytes,
      originalFilename: file.originalFilename,
      uploadedByUserId: file.uploadedByUserId,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      url: this.getFileUrl(file.objectKey),
    };
  }
}
