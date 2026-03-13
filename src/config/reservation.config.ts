import { registerAs } from '@nestjs/config';

const DEFAULT_REMINDER_LEAD_MINUTES = [120, 30];

function parseReminderLeadMinutes(rawValue?: string): number[] {
  const source = rawValue ?? DEFAULT_REMINDER_LEAD_MINUTES.join(',');

  return [...new Set(source.split(',').map((value) => Number(value.trim())))]
    .filter((value) => Number.isInteger(value) && value > 0)
    .sort((left, right) => right - left);
}

export const reservationConfig = registerAs('reservation', () => ({
  approvalTtlMinutes: Number(
    process.env['RESERVATION_APPROVAL_TTL_MINUTES'] ?? 5,
  ),
  reminderLeadMinutes: parseReminderLeadMinutes(
    process.env['RESERVATION_REMINDER_LEAD_MINUTES'],
  ),
  qrSecret: process.env['RESERVATION_QR_SECRET'] ?? '',
  qrTtlMinutes: Number(process.env['RESERVATION_QR_TTL_MINUTES'] ?? 10),
}));
