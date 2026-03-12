import { Global, Module } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';

import { databaseConfig } from '../config';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [databaseConfig.KEY],
      useFactory: (config: ConfigType<typeof databaseConfig>) =>
        new PrismaService(config),
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
