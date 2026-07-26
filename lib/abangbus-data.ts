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
    id: 'route-ormoc-sogod',
    code: 'ORMOC-SOGOD',
    name: 'Ormoc - Albuera - Baybay - Hilongos - Bato - Sogod',
    color: '#1D9E75',
    center: { latitude: 10.67, longitude: 124.79 },
    path: [
      { latitude: 11.009037, longitude: 124.609389 },
      { latitude: 10.999858, longitude: 124.615217 },
      { latitude: 10.989519, longitude: 124.623194 },
      { latitude: 10.976792, longitude: 124.632617 },
      { latitude: 10.967324, longitude: 124.641951 },
      { latitude: 10.957897, longitude: 124.653989 },
      { latitude: 10.948554, longitude: 124.670055 },
      { latitude: 10.939821, longitude: 124.68304 },
      { latitude: 10.920846, longitude: 124.692656 },
      { latitude: 10.911218, longitude: 124.700486 },
      { latitude: 10.89547, longitude: 124.708598 },
      { latitude: 10.879151, longitude: 124.71356 },
      { latitude: 10.851514, longitude: 124.741191 },
      { latitude: 10.838093, longitude: 124.751504 },
      { latitude: 10.808966, longitude: 124.766947 },
      { latitude: 10.77906, longitude: 124.782102 },
      { latitude: 10.761555, longitude: 124.787798 },
      { latitude: 10.745233, longitude: 124.791344 },
      { latitude: 10.736022, longitude: 124.796108 },
      { latitude: 10.716177, longitude: 124.795418 },
      { latitude: 10.699677, longitude: 124.798908 },
      { latitude: 10.683651, longitude: 124.80563 },
      { latitude: 10.679823, longitude: 124.802413 },
      { latitude: 10.674743, longitude: 124.800018 },
      { latitude: 10.662874, longitude: 124.808075 },
      { latitude: 10.647771, longitude: 124.804429 },
      { latitude: 10.641605, longitude: 124.795126 },
      { latitude: 10.635725, longitude: 124.786881 },
      { latitude: 10.634166, longitude: 124.779427 },
      { latitude: 10.628613, longitude: 124.781232 },
      { latitude: 10.620436, longitude: 124.77128 },
      { latitude: 10.59183, longitude: 124.766284 },
      { latitude: 10.579796, longitude: 124.765516 },
      { latitude: 10.56415, longitude: 124.765094 },
      { latitude: 10.544486, longitude: 124.765062 },
      { latitude: 10.523012, longitude: 124.759199 },
      { latitude: 10.507789, longitude: 124.75156 },
      { latitude: 10.500252, longitude: 124.741867 },
      { latitude: 10.488784, longitude: 124.726739 },
      { latitude: 10.472871, longitude: 124.729787 },
      { latitude: 10.457124, longitude: 124.731245 },
      { latitude: 10.437169, longitude: 124.728994 },
      { latitude: 10.422152, longitude: 124.730381 },
      { latitude: 10.393055, longitude: 124.741543 },
      { latitude: 10.373329, longitude: 124.74868 },
      { latitude: 10.370298, longitude: 124.755352 },
      { latitude: 10.358697, longitude: 124.775639 },
      { latitude: 10.341027, longitude: 124.783281 },
      { latitude: 10.327958, longitude: 124.789377 },
      { latitude: 10.344524, longitude: 124.813696 },
      { latitude: 10.349232, longitude: 124.823108 },
      { latitude: 10.342804, longitude: 124.832537 },
      { latitude: 10.340419, longitude: 124.843181 },
      { latitude: 10.344822, longitude: 124.856873 },
      { latitude: 10.344782, longitude: 124.864161 },
      { latitude: 10.340907, longitude: 124.879476 },
      { latitude: 10.336476, longitude: 124.889934 },
      { latitude: 10.330532, longitude: 124.906212 },
      { latitude: 10.331593, longitude: 124.910102 },
      { latitude: 10.329383, longitude: 124.915363 },
      { latitude: 10.32746, longitude: 124.928152 },
      { latitude: 10.327956, longitude: 124.935081 },
      { latitude: 10.33119, longitude: 124.94418 },
      { latitude: 10.332736, longitude: 124.945027 },
      { latitude: 10.338497, longitude: 124.961327 },
      { latitude: 10.348142, longitude: 124.970591 },
      { latitude: 10.357653, longitude: 124.969161 },
      { latitude: 10.371705, longitude: 124.969049 },
      { latitude: 10.380534, longitude: 124.97153 },
      { latitude: 10.383281, longitude: 124.978326 },
      { latitude: 10.383823, longitude: 124.982995 },
    ],
    stops: [
      {
        id: 'ormoc-terminal',
        name: 'Ormoc City South Terminal',
        location: { latitude: 11.009037, longitude: 124.609389 },
      },
      {
        id: 'albuera-poblacion',
        name: 'Albuera Poblacion',
        location: { latitude: 10.916655, longitude: 124.694366 },
      },
      {
        id: 'baybay-terminal',
        name: 'Baybay Public Terminal',
        location: { latitude: 10.675341, longitude: 124.79828 },
      },
      {
        id: 'hilongos-poblacion',
        name: 'Hilongos Poblacion',
        location: { latitude: 10.3733, longitude: 124.748817 },
      },
      {
        id: 'bato-poblacion',
        name: 'Bato Poblacion',
        location: { latitude: 10.32793, longitude: 124.789324 },
      },
      {
        id: 'sogod-terminal',
        name: 'Sogod Public Terminal',
        location: { latitude: 10.38399, longitude: 124.983005 },
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
