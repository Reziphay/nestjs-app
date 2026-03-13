import { DayOfWeek } from '@prisma/client';

const DAY_OF_WEEK_BY_UTC_INDEX: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

export function getDayOfWeekFromUtc(date: Date): DayOfWeek {
  return DAY_OF_WEEK_BY_UTC_INDEX[date.getUTCDay()];
}

export function formatUtcTime(date: Date): string {
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(
    date.getUTCMinutes(),
  ).padStart(2, '0')}`;
}

export function isSameUtcDate(left: Date, right: Date): boolean {
  return (
    left.getUTCFullYear() === right.getUTCFullYear() &&
    left.getUTCMonth() === right.getUTCMonth() &&
    left.getUTCDate() === right.getUTCDate()
  );
}

export function isReservationWindowInsideTimeRange(
  startTime: string,
  endTime: string | null,
  rangeStart: string,
  rangeEnd: string,
): boolean {
  if (startTime < rangeStart || startTime >= rangeEnd) {
    return false;
  }

  if (!endTime) {
    return true;
  }

  return endTime > startTime && endTime <= rangeEnd;
}

export function doReservationWindowsConflict(
  requestedStartAt: Date,
  requestedEndAt: Date | null,
  existingStartAt: Date,
  existingEndAt: Date | null,
): boolean {
  if (requestedEndAt && existingEndAt) {
    return (
      requestedStartAt.getTime() < existingEndAt.getTime() &&
      requestedEndAt.getTime() > existingStartAt.getTime()
    );
  }

  if (requestedEndAt && !existingEndAt) {
    return (
      existingStartAt.getTime() >= requestedStartAt.getTime() &&
      existingStartAt.getTime() < requestedEndAt.getTime()
    );
  }

  if (!requestedEndAt && existingEndAt) {
    return (
      requestedStartAt.getTime() >= existingStartAt.getTime() &&
      requestedStartAt.getTime() < existingEndAt.getTime()
    );
  }

  return requestedStartAt.getTime() === existingStartAt.getTime();
}
