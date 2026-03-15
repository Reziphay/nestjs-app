import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import * as express from 'express';
import helmet from 'helmet';
import { join } from 'path';

import { AppModule } from './app.module';
import { AppLoggerService } from './common/logger/app-logger.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(AppLoggerService));

  const configService = app.get(ConfigService);
  const apiPrefix = configService.getOrThrow<string>('app.apiPrefix');
  const swaggerEnabled =
    configService.getOrThrow<boolean>('app.swaggerEnabled');
  const corsOrigins = configService.getOrThrow<string[]>('app.corsOrigins');
  const port = configService.getOrThrow<number>('app.port');

  app.use(helmet());
  app.enableCors({
    origin: corsOrigins.length > 0 ? corsOrigins : true,
    credentials: true,
  });

  // Serve locally-stored uploads at /uploads/* when STORAGE_DRIVER=local.
  // In production use STORAGE_PUBLIC_URL pointing at S3/CDN instead.
  const storageDriver = configService.get<string>('storage.driver', 'local');
  if (storageDriver === 'local') {
    const localDir = configService.get<string>(
      'storage.localDir',
      '.local-storage/uploads',
    );
    app.use(
      '/uploads',
      express.static(join(process.cwd(), localDir), {
        maxAge: '1y',
        immutable: true,
      }),
    );
  }

  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  if (swaggerEnabled) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Reziphay Backend API')
      .setDescription('Reservation platform backend for Reziphay MVP')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  await app.listen(port);
  Logger.log(`Reziphay backend listening on port ${port}`, 'Bootstrap');
}

bootstrap().catch((error: unknown) => {
  const logger = new Logger('Bootstrap');

  logger.error(
    'Application failed to start.',
    error instanceof Error ? error.stack : undefined,
  );
  process.exitCode = 1;
});
