import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import {
  appConfig,
  authConfig,
  buildRedisOptions,
  databaseConfig,
  redisConfig,
  reservationConfig,
  storageConfig,
  validateEnv,
} from './config';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { RolesGuard } from './common/guards/roles.guard';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { AuthModule } from './auth/auth.module';
import { BrandsModule } from './brands/brands.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { ReservationsModule } from './reservations/reservations.module';
import { ServiceCategoriesModule } from './service-categories/service-categories.module';
import { ServicesModule } from './services/services.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      envFilePath: ['.env.local', '.env'],
      load: [
        appConfig,
        authConfig,
        databaseConfig,
        redisConfig,
        reservationConfig,
        storageConfig,
      ],
      validate: validateEnv,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (config: { url: string }) => ({
        connection: buildRedisOptions(config.url),
      }),
    }),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    BrandsModule,
    ServiceCategoriesModule,
    ServicesModule,
    ReservationsModule,
    StorageModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseEnvelopeInterceptor,
    },
  ],
})
export class AppModule {}
