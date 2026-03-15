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
  /**
   * Optional CDN / public base URL that overrides all auto-computed file URLs.
   *   local dev  → leave empty (files are served via GET /uploads/* by the app)
   *   MinIO      → "http://minio:9000/reziphay-local"
   *   AWS S3     → "https://reziphay.s3.eu-central-1.amazonaws.com"
   *   CDN        → "https://cdn.reziphay.com"
   */
  publicUrl: process.env['STORAGE_PUBLIC_URL'] ?? '',
}));
