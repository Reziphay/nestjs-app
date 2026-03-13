import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import { mkdir, writeFile } from 'fs/promises';
import { dirname, join } from 'path';

import { storageConfig } from '../config';
import type { ObjectStorageClient, UploadObjectInput } from './storage.types';

@Injectable()
export class LocalObjectStorageClient implements ObjectStorageClient {
  constructor(
    @Inject(storageConfig.KEY)
    private readonly storageConfiguration: ConfigType<typeof storageConfig>,
  ) {}

  async uploadObject(input: UploadObjectInput): Promise<void> {
    const absolutePath = join(
      process.cwd(),
      this.storageConfiguration.localDir,
      input.objectKey,
    );

    await mkdir(dirname(absolutePath), {
      recursive: true,
    });
    await writeFile(absolutePath, input.body);
  }
}
