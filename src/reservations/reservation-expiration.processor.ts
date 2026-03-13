import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { ReservationsService } from './reservations.service';
import {
  RESERVATION_EXPIRATION_JOB,
  RESERVATION_EXPIRATION_QUEUE,
} from './reservations.constants';

type ReservationExpirationJobData = {
  reservationId: string;
};

@Processor(RESERVATION_EXPIRATION_QUEUE)
export class ReservationExpirationProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationExpirationProcessor.name);

  constructor(private readonly reservationsService: ReservationsService) {
    super();
  }

  async process(job: Job<ReservationExpirationJobData>): Promise<void> {
    if (job.name !== RESERVATION_EXPIRATION_JOB) {
      this.logger.warn(`Ignoring unsupported reservation job "${job.name}".`);
      return;
    }

    await this.reservationsService.expirePendingReservation(
      job.data.reservationId,
    );
  }
}
