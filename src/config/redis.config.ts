import type { RedisOptions } from 'ioredis';
import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  url: process.env['REDIS_URL'] ?? '',
}));

export function buildRedisOptions(redisUrl: string): RedisOptions {
  const parsedUrl = new URL(redisUrl);
  const dbFromPath =
    parsedUrl.pathname && parsedUrl.pathname !== '/'
      ? Number(parsedUrl.pathname.slice(1))
      : 0;

  return {
    host: parsedUrl.hostname,
    port: Number(parsedUrl.port || 6379),
    username: parsedUrl.username || undefined,
    password: parsedUrl.password || undefined,
    db: Number.isNaN(dbFromPath) ? 0 : dbFromPath,
    tls: parsedUrl.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
    enableOfflineQueue: false,
    connectTimeout: 10_000,
  };
}
