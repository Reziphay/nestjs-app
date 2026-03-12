const DURATION_RE = /^(\d+)(ms|s|m|h|d)$/i;

const unitToMs: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
};

export function parseDurationToMilliseconds(value: string): number {
  const trimmedValue = value.trim();
  const match = DURATION_RE.exec(trimmedValue);

  if (!match) {
    throw new Error(`Invalid duration value: ${value}`);
  }

  const [, amount, unit] = match;
  const parsedAmount = Number(amount);

  return parsedAmount * unitToMs[unit.toLowerCase()];
}
