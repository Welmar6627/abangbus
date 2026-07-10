import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RouteMap from '@/components/RouteMap';
import { estimateEtaMinutes, formatMinutes, getRouteById, routes as localRoutes, type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';
import { getTrips, subscribeToTrips } from '@/lib/demo-tracker';
import { isRemoteBackendReady, loadActiveTrips, loadPilotRoutes, loadFavoriteStops, setFavoriteStop } from '@/lib/supabase-transit';
import { useSupabaseSession } from '@/lib/use-session';

export default function RouteDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ routeId?: string }>();
  const routeId = typeof params.routeId === 'string' ? params.routeId : localRoutes[0].id;
  const [session] = useSupabaseSession();
  const [routeList, setRouteList] = useState<RouteDefinition[]>(localRoutes);
  const [trips, setTrips] = useState<TripSnapshot[]>(getTrips());
  const [favoriteStopIds, setFavoriteStopIds] = useState<string[]>([]);
  const [busyStopId, setBusyStopId] = useState<string | null>(null);
  const backendReady = isRemoteBackendReady();

  useEffect(() => {
    let alive = true;

    const refresh = async () => {
      const remoteRoutes = await loadPilotRoutes();
      const remoteTrips = backendReady ? await loadActiveTrips(remoteRoutes) : getTrips();
      if (!alive) {
        return;
      }

      setRouteList(remoteRoutes);
      setTrips(remoteTrips);
    };

    void refresh();

    if (!backendReady) {
      const unsubscribe = subscribeToTrips((nextTrips) => {
        setTrips(nextTrips);
      });
      return () => {
        alive = false;
        unsubscribe();
      };
    }

    return () => {
      alive = false;
    };
  }, [backendReady]);

  useEffect(() => {
    if (!backendReady || !session) {
      setFavoriteStopIds([]);
      return;
    }

    let alive = true;
    loadFavoriteStops(session.user.id).then((favorites) => {
      if (alive) {
        setFavoriteStopIds(favorites.map((favorite) => favorite.stopId));
      }
    });

    return () => {
      alive = false;
    };
  }, [backendReady, session]);

  const route = useMemo(
    () => routeList.find((item) => item.id === routeId) ?? getRouteById(routeId) ?? routeList[0],
    [routeId, routeList],
  );

  const routeTrips = trips.filter((trip) => trip.routeId === route.id && trip.status === 'active');
  const nextTrip = routeTrips
    .map((trip) => ({
      trip,
      etaMinutes: estimateEtaMinutes(route, trip.progress, trip.speedKph),
    }))
    .sort((left, right) => left.etaMinutes - right.etaMinutes)[0];

  const handleToggleFavorite = async (stopId: string) => {
    if (!session) {
      router.push('/(rider)/favorites');
      return;
    }

    setBusyStopId(stopId);
    try {
      const isFavorite = favoriteStopIds.includes(stopId);
      await setFavoriteStop(session.user.id, stopId, !isFavorite);
      setFavoriteStopIds((current) =>
        current.includes(stopId) ? current.filter((id) => id !== stopId) : [...current, stopId],
      );
    } finally {
      setBusyStopId(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.topCard}>
        <Text style={styles.kicker}>{route.code}</Text>
        <Text style={styles.title}>{route.name}</Text>
        <Text style={styles.subtitle}>
          This page shows the stop order, live buses, and one-tap favorites for the route.
        </Text>
      </View>

      <View style={styles.section}>
        <RouteMap route={route} trips={routeTrips} selectedTripId={routeTrips[0]?.id ?? null} />
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Stops" value={`${route.stops.length}`} />
        <Metric label="Live buses" value={`${routeTrips.length}`} />
        <Metric label="Next bus" value={nextTrip ? formatMinutes(nextTrip.etaMinutes) : 'No active trip'} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Route stops</Text>
        <View style={styles.stopList}>
          {route.stops.map((stop, index) => {
            const favorite = favoriteStopIds.includes(stop.id);
            return (
              <Pressable key={stop.id} onPress={() => void handleToggleFavorite(stop.id)} style={styles.stopRow}>
                <View style={[styles.stopDot, { backgroundColor: route.color }]} />
                <View style={styles.stopTextWrap}>
                  <Text style={styles.stopName}>
                    {index + 1}. {stop.name}
                  </Text>
                  <Text style={styles.stopLocation}>
                    {stop.location.latitude.toFixed(4)}, {stop.location.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={styles.favoritePill}>
                  {busyStopId === stop.id ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.favoritePillText}>{favorite ? 'Saved' : 'Save'}</Text>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      {routeTrips.length ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active buses on this route</Text>
          <View style={styles.busList}>
            {routeTrips.map((trip) => {
              const etaMinutes = estimateEtaMinutes(route, trip.progress, trip.speedKph);
              return (
                <View key={trip.id} style={styles.busCard}>
                  <View style={styles.busRow}>
                    <View>
                      <Text style={styles.busCode}>{trip.busCode}</Text>
                      <Text style={styles.busDriver}>{trip.source === 'driver' ? 'Driver verified' : trip.driverName}</Text>
                    </View>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>ETA {formatMinutes(etaMinutes)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingBottom: 36,
    backgroundColor: '#07111D',
    minHeight: '100%',
  },
  topCard: {
    borderRadius: 30,
    padding: 20,
    backgroundColor: '#F8FAFC',
  },
  kicker: {
    color: '#1D9E75',
    textTransform: 'uppercase',
    fontWeight: '800',
    letterSpacing: 0.8,
    fontSize: 12,
  },
  title: {
    marginTop: 8,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.5,
  },
  subtitle: {
    marginTop: 10,
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    marginTop: 18,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 10,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 100,
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metricValue: {
    marginTop: 7,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  stopList: {
    gap: 10,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
    borderRadius: 18,
    padding: 14,
  },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  stopTextWrap: {
    flex: 1,
  },
  stopName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  stopLocation: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 12,
  },
  favoritePill: {
    minWidth: 58,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1D9E75',
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoritePillText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  busList: {
    gap: 10,
  },
  busCard: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
  },
  busRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  busCode: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  busDriver: {
    color: '#94A3B8',
    marginTop: 4,
    fontSize: 12,
  },
  liveBadge: {
    backgroundColor: '#E8F5EF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  liveBadgeText: {
    color: '#14704F',
    fontSize: 12,
    fontWeight: '800',
  },
});
