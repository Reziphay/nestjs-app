import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import { ReservationsService } from './reservations.service';
import {
  RESERVATION_EXPIRATION_JOB,
  RESERVATION_JOBS_QUEUE,
  RESERVATION_REMINDER_JOB,
} from './reservations.constants';

type ReservationJobData = {
  reservationId: string;
  leadMinutes?: number;
  scheduledStartAtIso?: string;
};

@Processor(RESERVATION_JOBS_QUEUE)
export class ReservationJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(ReservationJobsProcessor.name);

  constructor(private readonly reservationsService: ReservationsService) {
    super();
  }

  async process(job: Job<ReservationJobData>): Promise<void> {
    if (job.name === RESERVATION_EXPIRATION_JOB) {
      this.logger.log(`Processing reservation expiration job ${job.id}.`);
      await this.reservationsService.expirePendingReservation(
        job.data.reservationId,
      );
      return;
    }

    if (job.name === RESERVATION_REMINDER_JOB) {
      this.logger.log(`Processing reservation reminder job ${job.id}.`);
      await this.reservationsService.sendUpcomingReminder(
        job.data.reservationId,
        job.data.leadMinutes ?? 0,
        job.data.scheduledStartAtIso ?? '',
      );
      return;
    }

    this.logger.warn(`Ignoring unsupported reservation job "${job.name}".`);
  }
}
