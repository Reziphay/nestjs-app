import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { NotificationsModule } from '../notifications/notifications.module';
import { PENALTIES_QUEUE } from './penalties.constants';
import { PenaltyJobsService } from './penalty-jobs.service';
import { PenaltiesController } from './penalties.controller';
import { PenaltiesProcessor } from './penalties.processor';
import { PenaltiesService } from './penalties.service';
import { ReservationObjectionsController } from './reservation-objections.controller';

@Module({
  imports: [
    BullModule.registerQueue({
      name: PENALTIES_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    }),
    NotificationsModule,
  ],
  controllers: [PenaltiesController, ReservationObjectionsController],
  providers: [PenaltiesService, PenaltyJobsService, PenaltiesProcessor],
  exports: [PenaltiesService],
})
export class PenaltiesModule {}
