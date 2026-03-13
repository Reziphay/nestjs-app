import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  RESERVATION_EXPIRATION_JOB,
  RESERVATION_EXPIRATION_QUEUE,
} from './reservations.constants';

@Injectable()
export class ReservationJobsService {
  constructor(
    @InjectQueue(RESERVATION_EXPIRATION_QUEUE)
    private readonly reservationExpirationQueue: Queue,
  ) {}

  async schedulePendingExpiration(
    reservationId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.reservationExpirationQueue.add(
      RESERVATION_EXPIRATION_JOB,
      {
        reservationId,
      },
      {
        jobId: `${RESERVATION_EXPIRATION_JOB}:${reservationId}`,
        delay: Math.max(expiresAt.getTime() - Date.now(), 0),
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      },
    );
  }
}
