import { formatTripFreshness, getTripFreshness } from './trip-freshness';

describe('trip freshness', () => {
  const now = Date.parse('2026-08-24T12:00:00.000Z');

  it('classifies recent, delayed, and stale positions', () => {
    expect(getTripFreshness('2026-08-24T11:59:45.000Z', now)).toBe('live');
    expect(getTripFreshness('2026-08-24T11:59:00.000Z', now)).toBe('delayed');
    expect(getTripFreshness('2026-08-24T11:57:00.000Z', now)).toBe('stale');
  });

  it('fails closed for malformed timestamps', () => {
    expect(getTripFreshness('not-a-date', now)).toBe('stale');
    expect(formatTripFreshness('delayed')).toBe('Signal delayed');
  });
});
