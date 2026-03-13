import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { NotificationsModule } from '../notifications/notifications.module';
import { RESERVATION_EXPIRATION_QUEUE } from './reservations.constants';
import { ReservationExpirationProcessor } from './reservation-expiration.processor';
import { ReservationJobsService } from './reservation-jobs.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: RESERVATION_EXPIRATION_QUEUE,
    }),
    JwtModule.register({}),
    NotificationsModule,
  ],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationJobsService,
    ReservationExpirationProcessor,
  ],
  exports: [ReservationsService],
})
export class ReservationsModule {}
