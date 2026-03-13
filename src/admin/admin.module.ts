import { Module } from '@nestjs/common';

import { PenaltiesModule } from '../penalties/penalties.module';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  imports: [PenaltiesModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
