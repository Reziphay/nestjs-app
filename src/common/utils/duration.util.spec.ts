import { parseDurationToMilliseconds } from './duration.util';

describe('parseDurationToMilliseconds', () => {
  it('parses minute and day duration strings', () => {
    expect(parseDurationToMilliseconds('15m')).toBe(900_000);
    expect(parseDurationToMilliseconds('30d')).toBe(2_592_000_000);
  });

  it('throws on unsupported duration strings', () => {
    expect(() => parseDurationToMilliseconds('1w')).toThrow(
      'Invalid duration value',
    );
  });
});
