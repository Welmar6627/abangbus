import { isValidCoordinate } from '@/lib/input-validation';
import type { LatLng } from '@/lib/abangbus-data';

const POSTGIS_POINT_PATTERN = /^POINT\(\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*\)$/i;

export function parseGeographyPoint(value: unknown): LatLng | null {
  let latitude: number | undefined;
  let longitude: number | undefined;

  if (typeof value === 'string') {
    const match = value.match(POSTGIS_POINT_PATTERN);
    if (match) {
      longitude = Number(match[1]);
      latitude = Number(match[2]);
    }
  } else if (typeof value === 'object' && value !== null) {
    const candidate = value as { type?: unknown; coordinates?: unknown };
    if (
      candidate.type === 'Point' &&
      Array.isArray(candidate.coordinates) &&
      candidate.coordinates.length >= 2
    ) {
      longitude = Number(candidate.coordinates[0]);
      latitude = Number(candidate.coordinates[1]);
    }
  }

  if (latitude === undefined || longitude === undefined || !isValidCoordinate(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
}
