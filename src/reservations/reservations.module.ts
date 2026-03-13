import { BullModule } from '@nestjs/bullmq';
import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { DiscoveryStatsModule } from '../discovery-stats/discovery-stats.module';
import { NotificationPreferencesModule } from '../notification-preferences/notification-preferences.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RESERVATION_JOBS_QUEUE } from './reservations.constants';
import { ReservationJobsService } from './reservation-jobs.service';
import { ReservationJobsProcessor } from './reservation-jobs.processor';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: RESERVATION_JOBS_QUEUE,
    }),
    JwtModule.register({}),
    DiscoveryStatsModule,
    forwardRef(() => NotificationPreferencesModule),
    NotificationsModule,
  ],
  controllers: [ReservationsController],
  providers: [
    ReservationsService,
    ReservationJobsService,
    ReservationJobsProcessor,
  ],
  exports: [ReservationsService, ReservationJobsService],
})
export class ReservationsModule {}
