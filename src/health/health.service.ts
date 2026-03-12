import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

type DependencyStatus = {
  status: 'up' | 'down';
  details?: string;
};

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
  ) {}

  async getHealth(): Promise<Record<string, unknown>> {
    const [database, redis] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    return {
      status:
        database.status === 'up' && redis.status === 'up' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database,
        redis,
      },
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        status: 'up',
      };
    } catch (error) {
      return {
        status: 'down',
        details:
          error instanceof Error ? error.message : 'Unknown database error',
      };
    }
  }

  private async checkRedis(): Promise<DependencyStatus> {
    try {
      const response = await this.redisService.ping();

      return {
        status: response === 'PONG' ? 'up' : 'down',
        details:
          response === 'PONG'
            ? undefined
            : `Unexpected Redis response: ${response}`,
      };
    } catch (error) {
      return {
        status: 'down',
        details: error instanceof Error ? error.message : 'Unknown Redis error',
      };
    }
  }
}
