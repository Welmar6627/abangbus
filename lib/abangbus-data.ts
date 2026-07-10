export type LatLng = {
  latitude: number;
  longitude: number;
};

export type BusStop = {
  id: string;
  name: string;
  location: LatLng;
};

export type RouteDefinition = {
  id: string;
  code: string;
  name: string;
  color: string;
  path: LatLng[];
  stops: BusStop[];
  center: LatLng;
};

export type TripSource = 'driver' | 'demo';

export type TripSnapshot = {
  id: string;
  routeId: string;
  busCode: string;
  driverName: string;
  startedAt: string;
  lastUpdatedAt: string;
  status: 'active' | 'completed';
  source: TripSource;
  isMock: boolean;
  speedKph: number;
  accuracyM: number;
  bearing: number;
  progress: number;
  position: LatLng;
};

export const routes: RouteDefinition[] = [
  {
    id: 'route-04c',
    code: '04C',
    name: 'Colon - Talamban',
    color: '#1D9E75',
    center: { latitude: 10.3285, longitude: 123.9115 },
    path: [
      { latitude: 10.2966, longitude: 123.8971 },
      { latitude: 10.3047, longitude: 123.9012 },
      { latitude: 10.3143, longitude: 123.9048 },
      { latitude: 10.3231, longitude: 123.9085 },
      { latitude: 10.3324, longitude: 123.9122 },
      { latitude: 10.3416, longitude: 123.9159 },
      { latitude: 10.3507, longitude: 123.9191 },
      { latitude: 10.3602, longitude: 123.9221 },
    ],
    stops: [
      {
        id: 'colon',
        name: 'Colon Street',
        location: { latitude: 10.2966, longitude: 123.8971 },
      },
      {
        id: 'sambag',
        name: 'Sambag / Public Market',
        location: { latitude: 10.3143, longitude: 123.9048 },
      },
      {
        id: 'talamban',
        name: 'Talamban Terminal',
        location: { latitude: 10.3602, longitude: 123.9221 },
      },
    ],
  },
  {
    id: 'route-06b',
    code: '06B',
    name: 'Ayala - Lahug',
    color: '#2563EB',
    center: { latitude: 10.3248, longitude: 123.9118 },
    path: [
      { latitude: 10.3156, longitude: 123.8981 },
      { latitude: 10.3181, longitude: 123.9029 },
      { latitude: 10.3205, longitude: 123.9074 },
      { latitude: 10.3242, longitude: 123.9117 },
      { latitude: 10.3279, longitude: 123.9158 },
      { latitude: 10.3323, longitude: 123.9192 },
      { latitude: 10.3371, longitude: 123.9224 },
    ],
    stops: [
      {
        id: 'ayala',
        name: 'Ayala Center Cebu',
        location: { latitude: 10.3156, longitude: 123.8981 },
      },
      {
        id: 'lahug',
        name: 'Lahug / IT Park',
        location: { latitude: 10.3279, longitude: 123.9158 },
      },
      {
        id: 'banilad',
        name: 'Banilad Flyover',
        location: { latitude: 10.3371, longitude: 123.9224 },
      },
    ],
  },
];

export const defaultRouteId = routes[0].id;

export function getRouteById(routeId: string) {
  return routes.find((route) => route.id === routeId) ?? routes[0];
}

export function getRouteByCode(code: string) {
  return routes.find((route) => route.code === code);
}

export function distanceMeters(a: LatLng, b: LatLng) {
  const earthRadiusMeters = 6371000;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const deltaLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const deltaLng = ((b.longitude - a.longitude) * Math.PI) / 180;

  const sinLat = Math.sin(deltaLat / 2);
  const sinLng = Math.sin(deltaLng / 2);
  const c =
    2 *
    Math.atan2(
      Math.sqrt(sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng),
      Math.sqrt(1 - sinLat * sinLat - Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng),
    );

  return earthRadiusMeters * c;
}

export function routeLengthMeters(path: LatLng[]) {
  return path.slice(1).reduce((total, point, index) => {
    return total + distanceMeters(path[index], point);
  }, 0);
}

export function interpolateRoutePoint(path: LatLng[], progress: number) {
  const safeProgress = clamp(progress, 0, 1);
  if (path.length === 0) {
    return { latitude: 0, longitude: 0 };
  }

  if (path.length === 1) {
    return path[0];
  }

  const totalLength = routeLengthMeters(path);
  const targetDistance = totalLength * safeProgress;

  let accumulated = 0;
  for (let index = 1; index < path.length; index += 1) {
    const segmentStart = path[index - 1];
    const segmentEnd = path[index];
    const segmentLength = distanceMeters(segmentStart, segmentEnd);

    if (accumulated + segmentLength >= targetDistance) {
      const segmentProgress = segmentLength === 0 ? 0 : (targetDistance - accumulated) / segmentLength;
      return {
        latitude: segmentStart.latitude + (segmentEnd.latitude - segmentStart.latitude) * segmentProgress,
        longitude: segmentStart.longitude + (segmentEnd.longitude - segmentStart.longitude) * segmentProgress,
      };
    }

    accumulated += segmentLength;
  }

  return path[path.length - 1];
}

export function estimateProgressAlongRoute(path: LatLng[], point: LatLng) {
  if (path.length < 2) {
    return 0;
  }

  const totalLength = routeLengthMeters(path);
  let accumulated = 0;
  let bestMatch = {
    progress: 0,
    distance: Number.POSITIVE_INFINITY,
  };

  for (let index = 1; index < path.length; index += 1) {
    const start = path[index - 1];
    const end = path[index];
    const segmentLength = distanceMeters(start, end);
    if (segmentLength === 0) {
      accumulated += segmentLength;
      continue;
    }

    const projection = projectPointToSegment(point, start, end);
    const segmentProgress = accumulated + segmentLength * projection.t;
    const distance = distanceMeters(point, projection.point);

    if (distance < bestMatch.distance) {
      bestMatch = {
        progress: segmentProgress / totalLength,
        distance,
      };
    }

    accumulated += segmentLength;
  }

  return clamp(bestMatch.progress, 0, 1);
}

function projectPointToSegment(point: LatLng, start: LatLng, end: LatLng) {
  const ax = start.longitude;
  const ay = start.latitude;
  const bx = end.longitude;
  const by = end.latitude;
  const px = point.longitude;
  const py = point.latitude;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);

  return {
    t,
    point: {
      latitude: ay + dy * t,
      longitude: ax + dx * t,
    },
  };
}

export function estimateEtaMinutes(route: RouteDefinition, progress: number, speedKph: number) {
  const distanceRemainingMeters = routeLengthMeters(route.path) * (1 - clamp(progress, 0, 1));
  const speedMetersPerMinute = Math.max(speedKph, 12) * 1000 / 60;
  return Math.max(1, Math.round(distanceRemainingMeters / speedMetersPerMinute));
}

export function formatMinutes(minutes: number) {
  if (minutes <= 1) {
    return '1 min';
  }

  return `${minutes} mins`;
}

export function formatTimeAgo(timestamp: string) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(1, Math.round(diffMs / 60000));

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const hours = Math.round(diffMinutes / 60);
  return `${hours}h ago`;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function shortTripLabel(route: RouteDefinition) {
  return `${route.code} - ${route.name}`;
}
