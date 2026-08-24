import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import {
  estimateProgressAlongRoute,
  routes as localRoutes,
  type LatLng,
  type RouteDefinition,
  type TripSnapshot,
} from '@/lib/abangbus-data';
import { normalizeBusCode } from '@/lib/input-validation';
import { parseGeographyPoint } from '@/lib/transit-mappers';

export {
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  updatePassword,
} from '@/lib/supabase-auth';

export type FavoriteStopRecord = {
  stopId: string;
  routeId: string;
  stopName: string;
  routeCode: string;
  routeName: string;
  color: string;
  latitude: number;
  longitude: number;
};

export type AppRole = 'passenger' | 'driver' | 'admin';

export type UserProfile = {
  id: string;
  role: AppRole;
  displayName: string | null;
  phone: string | null;
};

type SupabaseRouteRow = {
  id: string;
  code: string;
  name: string;
  color: string | null;
  active: boolean | null;
};

type SupabaseStopRow = {
  id: string;
  name: string;
  location: unknown;
};

type SupabaseRouteStopRow = {
  route_id: string;
  sequence: number;
  stop_id: string;
};

type SupabaseTripRow = {
  id: string;
  route_id: string;
  bus_code: string | null;
  driver_id: string | null;
  status: string;
  started_at: string;
};

type SupabaseLivePositionRow = {
  trip_id: string;
  location: unknown;
  bearing: number | null;
  speed_mps: number | null;
  accuracy_m: number | null;
  source: string | null;
  is_mock: boolean | null;
  recorded_at: string;
};

export function isRemoteBackendReady() {
  return isSupabaseConfigured && Boolean(supabase);
}
export async function loadCurrentProfile(userId: string): Promise<UserProfile | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id, role, display_name, phone')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    role: data.role as AppRole,
    displayName: data.display_name,
    phone: data.phone,
  };
}

export async function loadPilotRoutes(): Promise<RouteDefinition[]> {
  if (!supabase) {
    return localRoutes;
  }

  const [routesResult, routeStopsResult, stopsResult] = await Promise.all([
    supabase.from('routes').select('id, code, name, color, active').order('code'),
    supabase.from('route_stops').select('route_id, sequence, stop_id').order('sequence'),
    supabase.from('stops').select('id, name, location'),
  ]);

  if (routesResult.error || routeStopsResult.error || stopsResult.error || !routesResult.data || !routeStopsResult.data || !stopsResult.data) {
    return localRoutes;
  }

  const stopMap = new Map<string, SupabaseStopRow>();
  stopsResult.data.forEach((stop) => stopMap.set(stop.id, stop));
  const routeRows = routesResult.data as SupabaseRouteRow[];
  const routeStopRows = routeStopsResult.data as SupabaseRouteStopRow[];

  return routeRows
    .filter((row) => row.active !== false)
    .map((row: SupabaseRouteRow) => {
      const fallback = localRoutes.find((route) => route.code === row.code) ?? localRoutes[0];
      const routeStops = routeStopRows
        .filter((routeStop: SupabaseRouteStopRow) => routeStop.route_id === row.id)
        .map((routeStop: SupabaseRouteStopRow) => {
          const stop = stopMap.get(routeStop.stop_id);
          if (!stop) {
            return null;
          }

          const location = parseGeographyPoint(stop.location);
          if (!location) return null;

          return {
            id: stop.id,
            name: stop.name,
            location,
          };
        })
        .filter(Boolean) as RouteDefinition['stops'];

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        color: row.color ?? fallback.color,
        path: fallback.path,
        center: fallback.center,
        stops: routeStops.length > 0 ? routeStops : fallback.stops,
      };
    });
}

export async function loadActiveTrips(routes: RouteDefinition[] = localRoutes): Promise<TripSnapshot[]> {
  if (!supabase) {
    return [];
  }

  const tripsResult = await supabase
    .from('trips')
    .select('id, route_id, bus_code, driver_id, status, started_at')
    .eq('status', 'active');

  if (tripsResult.error) throw tripsResult.error;
  if (!tripsResult.data?.length) return [];

  const tripIds = tripsResult.data.map((trip) => trip.id);
  const positionsResult = await supabase
    .from('live_positions')
    .select('trip_id, location, bearing, speed_mps, accuracy_m, source, is_mock, recorded_at')
    .in('trip_id', tripIds);

  if (positionsResult.error) throw positionsResult.error;
  if (!positionsResult.data) return [];

  const positions = new Map<string, SupabaseLivePositionRow>();
  positionsResult.data.forEach((row: SupabaseLivePositionRow) => positions.set(row.trip_id, row));
  const routeMap = new Map(routes.map((route) => [route.id, route]));

  return tripsResult.data
    .map((trip: SupabaseTripRow) => {
      const position = positions.get(trip.id);
      if (!position) {
        return null;
      }

      const route = routeMap.get(trip.route_id) ?? routes[0];
      const location = parseGeographyPoint(position.location);
      if (!location) return null;
      return {
        id: trip.id,
        routeId: trip.route_id,
        busCode: trip.bus_code ?? 'BUS',
        driverName: 'Verified driver',
        startedAt: trip.started_at,
        lastUpdatedAt: position.recorded_at,
        status: 'active' as const,
        source: (position.source === 'driver' ? 'driver' : 'demo') as 'driver' | 'demo',
        isMock: Boolean(position.is_mock),
        speedKph: Math.max(0, Math.round((position.speed_mps ?? 0) * 3.6)),
        accuracyM: position.accuracy_m ?? 0,
        bearing: position.bearing ?? 0,
        progress: route ? estimateProgressAlongRoute(route.path, location) : 0,
        position: location,
      } satisfies TripSnapshot;
    })
    .filter(Boolean) as TripSnapshot[];
}

export async function createRemoteTrip(params: { routeId: string; busCode: string }) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { data, error } = await supabase.rpc('start_trip', {
    p_route_id: params.routeId,
    p_bus_code: normalizeBusCode(params.busCode),
  });

  if (error || !data) {
    throw error ?? new Error('Unable to create trip.');
  }

  return data as SupabaseTripRow;
}

export async function upsertRemotePosition(params: {
  tripId: string;
  location: LatLng;
  bearing?: number | null;
  speedMps?: number | null;
  accuracyM?: number | null;
  source?: string;
  isMock?: boolean;
}) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.rpc('upsert_live_position', {
    p_trip_id: params.tripId,
    p_longitude: params.location.longitude,
    p_latitude: params.location.latitude,
    p_bearing: params.bearing ?? null,
    p_speed_mps: params.speedMps ?? null,
    p_accuracy_m: params.accuracyM ?? null,
    p_source: params.source ?? 'driver',
    p_is_mock: params.isMock ?? false,
  });

  if (error) {
    throw error;
  }
}
export async function completeRemoteTrip(tripId: string) {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  const { error } = await supabase.rpc('complete_trip', {
    p_trip_id: tripId,
  });

  if (error) {
    throw error;
  }
}

export async function loadFavoriteStops(userId: string): Promise<FavoriteStopRecord[]> {
  if (!supabase) {
    return [];
  }

  const [favoritesResult, stopsResult, routeStopsResult, routesResult] = await Promise.all([
    supabase.from('favorites').select('stop_id').eq('user_id', userId),
    supabase.from('stops').select('id, name, location'),
    supabase.from('route_stops').select('route_id, stop_id'),
    supabase.from('routes').select('id, code, name, color'),
  ]);

  if (
    favoritesResult.error ||
    stopsResult.error ||
    routeStopsResult.error ||
    routesResult.error ||
    !favoritesResult.data ||
    !stopsResult.data ||
    !routeStopsResult.data ||
    !routesResult.data
  ) {
    return [];
  }

  const stopMap = new Map(stopsResult.data.map((stop: SupabaseStopRow) => [stop.id, stop] as [string, SupabaseStopRow]));
  const routeMap = new Map((routesResult.data as SupabaseRouteRow[]).map((route) => [route.id, route] as [string, SupabaseRouteRow]));
  const stopRouteMap = new Map<string, SupabaseRouteStopRow>();
  (routeStopsResult.data as SupabaseRouteStopRow[]).forEach((row) => {
    if (!stopRouteMap.has(row.stop_id)) {
      stopRouteMap.set(row.stop_id, row);
    }
  });

  return (favoritesResult.data as { stop_id: string }[])
    .map((row: { stop_id: string }) => {
      const stop = stopMap.get(row.stop_id);
      const routeStop = stopRouteMap.get(row.stop_id);
      const route = routeStop ? routeMap.get(routeStop.route_id) : null;

      if (!stop || !route) {
        return null;
      }

      const location = parseGeographyPoint(stop.location);
      if (!location) return null;
      return {
        stopId: row.stop_id,
        routeId: route.id,
        stopName: stop.name,
        routeCode: route.code,
        routeName: route.name,
        color: route.color ?? '#1D9E75',
        latitude: location.latitude,
        longitude: location.longitude,
      };
    })
    .filter(Boolean) as FavoriteStopRecord[];
}

export async function setFavoriteStop(userId: string, stopId: string, favorite: boolean) {
  if (!supabase) {
    return;
  }

  if (favorite) {
    const { error } = await supabase.from('favorites').upsert(
      {
        user_id: userId,
        stop_id: stopId,
      },
      { onConflict: 'user_id,stop_id' },
    );
    if (error) {
      throw error;
    }
    return;
  }

  const { error } = await supabase.from('favorites').delete().eq('user_id', userId).eq('stop_id', stopId);
  if (error) {
    throw error;
  }
}
