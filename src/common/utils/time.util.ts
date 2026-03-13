export const HH_MM_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidTimeRange(startTime: string, endTime: string): boolean {
  return (
    HH_MM_PATTERN.test(startTime) &&
    HH_MM_PATTERN.test(endTime) &&
    startTime < endTime
  );
}
