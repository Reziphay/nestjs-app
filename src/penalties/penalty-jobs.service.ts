import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import {
  CLEANUP_PENALTIES_JOB,
  NO_SHOW_SCAN_INTERVAL_MS,
  PENALTY_CLEANUP_INTERVAL_MS,
  PENALTIES_QUEUE,
  PROCESS_NO_SHOWS_JOB,
} from './penalties.constants';

@Injectable()
export class PenaltyJobsService implements OnModuleInit {
  constructor(
    @InjectQueue(PENALTIES_QUEUE)
    private readonly penaltiesQueue: Queue,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.penaltiesQueue.add(
      PROCESS_NO_SHOWS_JOB,
      {},
      {
        jobId: PROCESS_NO_SHOWS_JOB,
        repeat: {
          every: NO_SHOW_SCAN_INTERVAL_MS,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );

    await this.penaltiesQueue.add(
      CLEANUP_PENALTIES_JOB,
      {},
      {
        jobId: CLEANUP_PENALTIES_JOB,
        repeat: {
          every: PENALTY_CLEANUP_INTERVAL_MS,
        },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
}
