import { Module } from '@nestjs/common';

import { ReservationPopularityStatsService } from './reservation-popularity-stats.service';

@Module({
  providers: [ReservationPopularityStatsService],
  exports: [ReservationPopularityStatsService],
})
export class DiscoveryStatsModule {}
