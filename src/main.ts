import 'reflect-metadata';

import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerCustomOptions,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from 'src/app.module';
import { HttpExceptionFilter } from 'src/common/filters/http-exception.filter';
import { ApiResponseInterceptor } from 'src/common/interceptors/api-response.interceptor';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const appName = configService.get<string>('app.name', { infer: true });
  const port = Number(configService.get('app.port', { infer: true }) ?? 3000);
  const apiPrefix =
    configService.get<string>('app.apiPrefix', { infer: true }) ?? 'api/v1';
  const swaggerPath =
    configService.get<string>('app.swaggerPath', { infer: true }) ?? 'api/docs';

  app.enableCors();
  app.setGlobalPrefix(apiPrefix);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalInterceptors(new ApiResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle(appName ?? 'Reziphay API')
    .setDescription('Reziphay mobile and admin backend API')
    .setVersion('0.1.0')
    .addBearerAuth()
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const swaggerOptions: SwaggerCustomOptions = {
    swaggerOptions: {
      persistAuthorization: true,
    },
  };
  SwaggerModule.setup(swaggerPath, app, swaggerDocument, swaggerOptions);

  app.enableShutdownHooks();
  await app.listen(port);
}

void bootstrap();
