import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  driver: process.env['STORAGE_DRIVER'] ?? 'local',
  localDir: process.env['STORAGE_LOCAL_DIR'] ?? '.local-storage/uploads',
  bucket: process.env['S3_BUCKET'] ?? 'reziphay-local',
  endpoint: process.env['S3_ENDPOINT'] ?? '',
  region: process.env['S3_REGION'] ?? '',
  accessKey: process.env['S3_ACCESS_KEY'] ?? '',
  secretKey: process.env['S3_SECRET_KEY'] ?? '',
  forcePathStyle: process.env['S3_FORCE_PATH_STYLE'] === 'true',
}));
