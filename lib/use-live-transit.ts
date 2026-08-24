import { useCallback, useEffect, useRef, useState } from 'react';
import { routes as localRoutes, type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';
import { getTrips, subscribeToTrips } from '@/lib/demo-tracker';
import { isRemoteBackendReady, loadActiveTrips, loadPilotRoutes } from '@/lib/supabase-transit';
import { supabase } from '@/lib/supabase';

const REALTIME_REFRESH_DELAY_MS = 150;

export function useLiveTransit(channelName: string) {
  const backendReady = isRemoteBackendReady();
  const [routes, setRoutes] = useState<RouteDefinition[]>(localRoutes);
  const [trips, setTrips] = useState<TripSnapshot[]>(getTrips());
  const [loading, setLoading] = useState(backendReady);
  const [error, setError] = useState<string | null>(null);
  const routesRef = useRef<RouteDefinition[]>(localRoutes);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlight = useRef(false);
  const refreshQueued = useRef(false);

  const refreshTrips = useCallback(async () => {
    if (refreshInFlight.current) {
      refreshQueued.current = true;
      return;
    }

    refreshInFlight.current = true;
    try {
      setTrips(await loadActiveTrips(routesRef.current));
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Live trip data is temporarily unavailable.');
    } finally {
      refreshInFlight.current = false;
      if (refreshQueued.current) {
        refreshQueued.current = false;
        void refreshTrips();
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;

    if (!backendReady) {
      setLoading(false);
      setError(null);
      return subscribeToTrips(setTrips);
    }

    const initialize = async () => {
      setLoading(true);
      try {
        const nextRoutes = await loadPilotRoutes();
        if (!alive) return;
        routesRef.current = nextRoutes;
        setRoutes(nextRoutes);
        await refreshTrips();
      } catch (cause) {
        if (alive) setError(cause instanceof Error ? cause.message : 'Transit data is temporarily unavailable.');
      } finally {
        if (alive) setLoading(false);
      }
    };

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => void refreshTrips(), REALTIME_REFRESH_DELAY_MS);
    };

    void initialize();
    const channel = supabase
      ?.channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions' }, scheduleRefresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, scheduleRefresh)
      .subscribe();

    return () => {
      alive = false;
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      if (channel) void supabase?.removeChannel(channel);
    };
  }, [backendReady, channelName, refreshTrips]);

  return { routes, trips, loading, error, backendReady, refresh: refreshTrips };
}
