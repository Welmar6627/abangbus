import { clamp, defaultRouteId, estimateEtaMinutes, estimateProgressAlongRoute, getRouteById, interpolateRoutePoint, type LatLng, type TripSnapshot } from '@/lib/abangbus-data';

type Listener = (trips: TripSnapshot[]) => void;

const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setInterval>>();

function createSeedTrip(routeId: string, busCode: string, driverName: string, progress: number, speedKph: number): TripSnapshot {
  const route = getRouteById(routeId);
  const position = interpolateRoutePoint(route.path, progress);

  return {
    id: `${routeId}-${busCode}`.toLowerCase(),
    routeId,
    busCode,
    driverName,
    startedAt: new Date(Date.now() - 17 * 60000).toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: 'active',
    source: 'demo',
    isMock: true,
    speedKph,
    accuracyM: 15,
    bearing: 95,
    progress,
    position,
  };
}

const seedTrips: TripSnapshot[] = [
  createSeedTrip(defaultRouteId, 'AB-142', 'Kuya Ben', 0.26, 26),
  createSeedTrip(defaultRouteId, 'AB-208', 'Ate Lani', 0.68, 31),
];

let activeTrips = [...seedTrips];

function publish() {
  listeners.forEach((listener) => listener(activeTrips));
}

function upsertTrip(trip: TripSnapshot) {
  activeTrips = [trip, ...activeTrips.filter((current) => current.id !== trip.id)];
  publish();
}

function clearTimer(tripId: string) {
  const timer = timers.get(tripId);
  if (timer) {
    clearInterval(timer);
    timers.delete(tripId);
  }
}

function startTripMotion(tripId: string) {
  clearTimer(tripId);
  const timer = setInterval(() => {
    const current = activeTrips.find((trip) => trip.id === tripId);
    if (!current) {
      clearTimer(tripId);
      return;
    }

    const route = getRouteById(current.routeId);
    const progressStep = (current.speedKph / 3600) * 8.5;
    const nextProgress = clamp(current.progress + progressStep, 0, 1);
    const nextPosition = interpolateRoutePoint(route.path, nextProgress);

    upsertTrip({
      ...current,
      progress: nextProgress,
      position: nextPosition,
      speedKph: Math.max(18, Math.min(36, current.speedKph + (Math.random() * 4 - 2))),
      accuracyM: 8 + Math.random() * 12,
      bearing: 70 + Math.random() * 40,
      lastUpdatedAt: new Date().toISOString(),
    });
  }, 8000);

  timers.set(tripId, timer);
}

function stopMotion(tripId: string) {
  clearTimer(tripId);
}

function resumeMotion(tripId: string) {
  startTripMotion(tripId);
}

export function subscribeToTrips(listener: Listener) {
  listeners.add(listener);
  listener(activeTrips);
  return () => {
    listeners.delete(listener);
  };
}

export function getTrips() {
  return [...activeTrips];
}

export function startDemoTrip(params: { routeId: string; busCode: string; driverName: string; motionEnabled?: boolean }) {
  const route = getRouteById(params.routeId);
  const trip: TripSnapshot = {
    id: `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    routeId: route.id,
    busCode: params.busCode.trim().toUpperCase(),
    driverName: params.driverName.trim() || 'Driver',
    startedAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    status: 'active',
    source: 'demo',
    isMock: true,
    speedKph: 27,
    accuracyM: 12,
    bearing: 92,
    progress: 0.18,
    position: interpolateRoutePoint(route.path, 0.18),
  };

  upsertTrip(trip);
  if (params.motionEnabled !== false) {
    startTripMotion(trip.id);
  }
  return trip;
}

export function endDemoTrip(tripId: string) {
  clearTimer(tripId);
  activeTrips = activeTrips.filter((trip) => trip.id !== tripId);
  publish();
}

export function pauseTripMotion(tripId: string) {
  stopMotion(tripId);
}

export function resumeTripMotionForTrip(tripId: string) {
  resumeMotion(tripId);
}

export function updateTripLocation(tripId: string, location: LatLng, extras?: Partial<Pick<TripSnapshot, 'accuracyM' | 'speedKph' | 'bearing' | 'isMock'>>) {
  const current = activeTrips.find((trip) => trip.id === tripId);
  if (!current) {
    return;
  }

  const route = getRouteById(current.routeId);
  const nextProgress = estimateProgressAlongRoute(route.path, location);

  upsertTrip({
    ...current,
    progress: nextProgress,
    position: location,
    accuracyM: extras?.accuracyM ?? current.accuracyM,
    speedKph: extras?.speedKph ?? current.speedKph,
    bearing: extras?.bearing ?? current.bearing,
    isMock: extras?.isMock ?? current.isMock,
    lastUpdatedAt: new Date().toISOString(),
  });
}

export function getTripSummary(trip: TripSnapshot) {
  const route = getRouteById(trip.routeId);
  return {
    route,
    etaMinutes: estimateEtaMinutes(route, trip.progress, trip.speedKph),
  };
}

seedTrips.forEach((trip) => {
  activeTrips = [trip, ...activeTrips.filter((current) => current.id !== trip.id)];
  startTripMotion(trip.id);
});
