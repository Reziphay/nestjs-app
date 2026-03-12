import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import configuration from 'src/common/config/configuration';
import { validateEnv } from 'src/common/config/env.validation';
import { AuthModule } from 'src/modules/auth/auth.module';
import { HealthModule } from 'src/modules/health/health.module';
import { PrismaModule } from 'src/modules/prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      expandVariables: true,
      load: [configuration],
      validate: validateEnv,
    }),
    AuthModule,
    PrismaModule,
    HealthModule,
  ],
})
export class AppModule {}
