import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  CLEANUP_PENALTIES_JOB,
  PENALTIES_QUEUE,
  PROCESS_NO_SHOWS_JOB,
} from './penalties.constants';
import { PenaltiesService } from './penalties.service';

@Processor(PENALTIES_QUEUE)
export class PenaltiesProcessor extends WorkerHost {
  private readonly logger = new Logger(PenaltiesProcessor.name);

  constructor(private readonly penaltiesService: PenaltiesService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name === PROCESS_NO_SHOWS_JOB) {
      await this.penaltiesService.processNoShows();
      return;
    }

    if (job.name === CLEANUP_PENALTIES_JOB) {
      await this.penaltiesService.cleanupExpiredPenaltyState();
      return;
    }

    this.logger.warn(`Ignoring unsupported penalties job "${job.name}".`);
  }
}
