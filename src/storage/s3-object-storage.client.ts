import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { storageConfig } from '../config';
import type { ObjectStorageClient, UploadObjectInput } from './storage.types';

@Injectable()
export class S3ObjectStorageClient implements ObjectStorageClient {
  private client: S3Client | null = null;

  constructor(
    @Inject(storageConfig.KEY)
    private readonly storageConfiguration: ConfigType<typeof storageConfig>,
  ) {}

  async uploadObject(input: UploadObjectInput): Promise<void> {
    const client = this.getClient();

    await client.send(
      new PutObjectCommand({
        Bucket: this.storageConfiguration.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  private getClient(): S3Client {
    if (this.client) {
      return this.client;
    }

    this.client = new S3Client({
      region: this.storageConfiguration.region,
      ...(this.storageConfiguration.endpoint
        ? {
            endpoint: this.storageConfiguration.endpoint,
          }
        : {}),
      forcePathStyle: this.storageConfiguration.forcePathStyle,
      credentials: {
        accessKeyId: this.storageConfiguration.accessKey,
        secretAccessKey: this.storageConfiguration.secretKey,
      },
    });

    return this.client;
  }
}
