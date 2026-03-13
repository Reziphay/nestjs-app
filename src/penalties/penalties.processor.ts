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
      this.logger.log(`Processing penalties job ${job.name}.`);
      const outcome = await this.penaltiesService.processNoShows();
      const processedCount =
        typeof outcome['processedCount'] === 'number'
          ? outcome['processedCount']
          : 0;

      this.logger.log(
        `Completed penalties job ${job.name} with ${processedCount} processed reservations.`,
      );
      return;
    }

    if (job.name === CLEANUP_PENALTIES_JOB) {
      this.logger.log(`Processing penalties job ${job.name}.`);
      const outcome = await this.penaltiesService.cleanupExpiredPenaltyState();
      const affectedUsers =
        typeof outcome['affectedUsers'] === 'number'
          ? outcome['affectedUsers']
          : 0;

      this.logger.log(
        `Completed penalties job ${job.name} with ${affectedUsers} affected users.`,
      );
      return;
    }

    this.logger.warn(`Ignoring unsupported penalties job "${job.name}".`);
  }
}
