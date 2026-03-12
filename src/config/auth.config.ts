import { registerAs } from '@nestjs/config';

export type DurationString = `${number}${'ms' | 's' | 'm' | 'h' | 'd'}`;

export const authConfig = registerAs('auth', () => ({
  accessSecret: process.env['JWT_ACCESS_SECRET'] ?? '',
  refreshSecret: process.env['JWT_REFRESH_SECRET'] ?? '',
  accessTtl: (process.env['JWT_ACCESS_TTL'] ?? '15m') as DurationString,
  refreshTtl: (process.env['JWT_REFRESH_TTL'] ?? '30d') as DurationString,
  otpTtlMinutes: Number(process.env['OTP_TTL_MINUTES'] ?? 10),
  otpMaxAttempts: Number(process.env['OTP_MAX_ATTEMPTS'] ?? 5),
  magicLinkTtlMinutes: Number(process.env['MAGIC_LINK_TTL_MINUTES'] ?? 60),
  hashSecret: process.env['AUTH_HASH_SECRET'] ?? '',
}));
