import { registerAs } from '@nestjs/config';

export const reservationConfig = registerAs('reservation', () => ({
  approvalTtlMinutes: Number(
    process.env['RESERVATION_APPROVAL_TTL_MINUTES'] ?? 5,
  ),
  qrSecret: process.env['RESERVATION_QR_SECRET'] ?? '',
  qrTtlMinutes: Number(process.env['RESERVATION_QR_TTL_MINUTES'] ?? 10),
}));
