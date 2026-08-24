export type TripFreshness = 'live' | 'delayed' | 'stale';

export function getTripFreshness(lastUpdatedAt: string, now = Date.now()): TripFreshness {
  const recordedAt = Date.parse(lastUpdatedAt);
  if (!Number.isFinite(recordedAt)) return 'stale';

  const ageMs = Math.max(0, now - recordedAt);
  if (ageMs <= 30_000) return 'live';
  if (ageMs <= 90_000) return 'delayed';
  return 'stale';
}

export function formatTripFreshness(freshness: TripFreshness) {
  if (freshness === 'live') return 'Live';
  if (freshness === 'delayed') return 'Signal delayed';
  return 'Last position';
}
