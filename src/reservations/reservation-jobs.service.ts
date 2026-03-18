import { InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigType } from '@nestjs/config';
import type { Queue } from 'bullmq';

import { reservationConfig } from '../config';
import {
  RESERVATION_EXPIRATION_JOB,
  RESERVATION_JOBS_QUEUE,
  RESERVATION_REMINDER_JOB,
} from './reservations.constants';

@Injectable()
export class ReservationJobsService {
  constructor(
    @InjectQueue(RESERVATION_JOBS_QUEUE)
    private readonly reservationQueue: Queue,
    @Inject(reservationConfig.KEY)
    private readonly reservationConfiguration: ConfigType<
      typeof reservationConfig
    >,
  ) {}

  async schedulePendingExpiration(
    reservationId: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.reservationQueue.add(
      RESERVATION_EXPIRATION_JOB,
      {
        reservationId,
      },
      {
        jobId: `${RESERVATION_EXPIRATION_JOB}.${reservationId}`,
        delay: Math.max(expiresAt.getTime() - Date.now(), 0),
        removeOnComplete: 1_000,
        removeOnFail: 1_000,
      },
    );
  }

  async scheduleUpcomingReminders(
    reservationId: string,
    requestedStartAt: Date,
    leadMinutesOverride?: number[],
  ): Promise<number> {
    let scheduledCount = 0;
    const leadMinutesToSchedule = [
      ...new Set(
        (
          leadMinutesOverride ??
          this.reservationConfiguration.reminderLeadMinutes
        ).filter((value) => Number.isInteger(value) && value > 0),
      ),
    ].sort((left, right) => right - left);

    for (const leadMinutes of leadMinutesToSchedule) {
      const reminderAt = new Date(
        requestedStartAt.getTime() - leadMinutes * 60_000,
      );
      const delay = reminderAt.getTime() - Date.now();

      if (delay <= 0) {
        continue;
      }

      await this.reservationQueue.add(
        RESERVATION_REMINDER_JOB,
        {
          reservationId,
          leadMinutes,
          scheduledStartAtIso: requestedStartAt.toISOString(),
        },
        {
          jobId: this.getReminderJobId(reservationId, leadMinutes),
          delay,
          removeOnComplete: 1_000,
          removeOnFail: 1_000,
        },
      );

      scheduledCount += 1;
    }

    return scheduledCount;
  }

  async cancelUpcomingReminders(reservationId: string): Promise<void> {
    const reminderJobs = await this.reservationQueue.getJobs([
      'delayed',
      'waiting',
      'prioritized',
    ]);

    await Promise.all(
      reminderJobs
        .filter((job) => {
          const jobData = job.data as Record<string, unknown>;

          return (
            job.name === RESERVATION_REMINDER_JOB &&
            jobData['reservationId'] === reservationId
          );
        })
        .map(async (job) => {
          await job.remove();
        }),
    );
  }

  private getReminderJobId(reservationId: string, leadMinutes: number): string {
    return `${RESERVATION_REMINDER_JOB}.${reservationId}.${leadMinutes}`;
  }
}
