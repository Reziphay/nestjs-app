import { Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { storageConfig } from '../config';
import { LocalObjectStorageClient } from './local-object-storage.client';
import { S3ObjectStorageClient } from './s3-object-storage.client';
import { OBJECT_STORAGE_CLIENT } from './storage.constants';
import { StorageService } from './storage.service';

@Module({
  providers: [
    LocalObjectStorageClient,
    S3ObjectStorageClient,
    {
      provide: OBJECT_STORAGE_CLIENT,
      inject: [
        storageConfig.KEY,
        LocalObjectStorageClient,
        S3ObjectStorageClient,
      ],
      useFactory: (
        config: ConfigType<typeof storageConfig>,
        localObjectStorageClient: LocalObjectStorageClient,
        s3ObjectStorageClient: S3ObjectStorageClient,
      ) =>
        config.driver === 's3'
          ? s3ObjectStorageClient
          : localObjectStorageClient,
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
