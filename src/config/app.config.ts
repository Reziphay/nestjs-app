import { registerAs } from '@nestjs/config';

export const appConfig = registerAs('app', () => {
  const rawCorsOrigins = process.env['CORS_ORIGIN'] ?? '';

  return {
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    port: Number(process.env['PORT'] ?? 3000),
    apiPrefix: process.env['API_PREFIX'] ?? 'api/v1',
    appBaseUrl: process.env['APP_BASE_URL'] ?? 'http://localhost:3000',
    corsOrigins: rawCorsOrigins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    swaggerEnabled: process.env['SWAGGER_ENABLED'] === 'true',
    isProduction: process.env['NODE_ENV'] === 'production',
  };
});
