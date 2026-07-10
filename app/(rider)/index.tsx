import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import RouteMap from '@/components/RouteMap';
import { estimateEtaMinutes, formatMinutes, formatTimeAgo, getRouteById, routes as localRoutes, type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';
import { getTrips, subscribeToTrips } from '@/lib/demo-tracker';
import { isRemoteBackendReady, loadActiveTrips, loadPilotRoutes } from '@/lib/supabase-transit';
import { supabase } from '@/lib/supabase';

export default function RiderScreen() {
  const router = useRouter();
  const [selectedRouteId, setSelectedRouteId] = useState(localRoutes[0].id);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [trips, setTrips] = useState<TripSnapshot[]>(getTrips());
  const [routeList, setRouteList] = useState<RouteDefinition[]>(localRoutes);
  const backendReady = isRemoteBackendReady();

  useEffect(() => {
    let alive = true;

    if (!backendReady) {
      return subscribeToTrips(setTrips);
    }

    const refresh = async () => {
      const remoteRoutes = await loadPilotRoutes();
      const remoteTrips = await loadActiveTrips(remoteRoutes);
      if (alive) {
        setRouteList(remoteRoutes);
        setTrips(remoteTrips);
        if (!remoteRoutes.some((route) => route.id === selectedRouteId) && remoteRoutes[0]) {
          setSelectedRouteId(remoteRoutes[0].id);
        }
      }
    };

    void refresh();

    const channel = supabase
      ? supabase
          .channel('abangbus-rider-live')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions' }, refresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, refresh)
          .subscribe()
      : null;

    return () => {
      alive = false;
      if (channel) {
        void supabase?.removeChannel(channel);
      }
    };
  }, [backendReady, selectedRouteId]);

  const selectedRoute = useMemo(
    () => routeList.find((route) => route.id === selectedRouteId) ?? getRouteById(selectedRouteId) ?? routeList[0],
    [routeList, selectedRouteId],
  );

  const routeTrips = trips.filter((trip) => trip.routeId === selectedRouteId && trip.status === 'active');
  const selectedTrip = selectedTripId ? routeTrips.find((trip) => trip.id === selectedTripId) ?? routeTrips[0] ?? null : routeTrips[0] ?? null;

  useEffect(() => {
    if (selectedTrip && selectedTrip.id !== selectedTripId) {
      setSelectedTripId(selectedTrip.id);
    }
  }, [selectedTrip, selectedTripId]);

  const liveCount = routeTrips.length;
  const nextTrip = routeTrips
    .map((trip) => ({
      trip,
      etaMinutes: estimateEtaMinutes(selectedRoute, trip.progress, trip.speedKph),
    }))
    .sort((left, right) => left.etaMinutes - right.etaMinutes)[0];

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.topCard}>
        <View style={styles.topRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Rider map</Text>
          </View>
          <View style={[styles.statusPill, backendReady ? styles.onlinePill : styles.offlinePill]}>
            <Text style={styles.statusPillText}>{backendReady ? 'Supabase live' : 'Local demo'}</Text>
          </View>
        </View>
        <Text style={styles.title}>See live buses before you leave the terminal.</Text>
        <Text style={styles.subtitle}>
          This map updates from driver-shared trips first. Riders can browse without logging in or giving location permission.
        </Text>
        <View style={styles.headerButtons}>
          <Pressable style={[styles.smallButton, styles.secondaryButton]} onPress={() => router.push('/(rider)/favorites')}>
            <Text style={styles.smallButtonText}>Favorites</Text>
          </Pressable>
          <Pressable
            style={[styles.smallButton, styles.primaryButton]}
            onPress={() => router.push({ pathname: '/(rider)/route/[routeId]', params: { routeId: selectedRouteId } })}
          >
            <Text style={styles.smallButtonText}>Route detail</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose a route</Text>
        <View style={styles.routeRow}>
          {routeList.map((route) => {
            const selected = route.id === selectedRouteId;
            return (
              <Pressable
                key={route.id}
                onPress={() => {
                  setSelectedRouteId(route.id);
                  setSelectedTripId(null);
                }}
                style={[
                  styles.routeChip,
                  {
                    backgroundColor: selected ? route.color : '#132033',
                    borderColor: route.color,
                  },
                ]}
              >
                <Text style={styles.routeChipCode}>{route.code}</Text>
                <Text style={styles.routeChipText}>{route.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <RouteMap
          route={selectedRoute}
          trips={routeTrips}
          selectedTripId={selectedTrip?.id ?? null}
          onSelectTrip={setSelectedTripId}
        />
      </View>

      <View style={styles.metricsRow}>
        <Metric label="Live buses" value={`${liveCount}`} />
        <Metric label="Next bus" value={nextTrip ? `${formatMinutes(nextTrip.etaMinutes)}` : 'No active trip'} />
        <Metric label="Stops" value={`${selectedRoute.stops.length}`} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Current buses</Text>
        {routeTrips.length ? (
          <View style={styles.busList}>
            {routeTrips.map((trip) => {
              const etaMinutes = estimateEtaMinutes(selectedRoute, trip.progress, trip.speedKph);
              const selected = selectedTrip?.id === trip.id;
              return (
                <Pressable
                  key={trip.id}
                  onPress={() => setSelectedTripId(trip.id)}
                  style={[styles.busCard, selected && styles.busCardSelected]}
                >
                  <View style={styles.busCardTop}>
                    <View>
                      <Text style={styles.busCode}>{trip.busCode}</Text>
                      <Text style={styles.busDriver}>{trip.source === 'driver' ? 'Driver verified' : trip.driverName}</Text>
                    </View>
                    <View style={styles.liveBadge}>
                      <Text style={styles.liveBadgeText}>{trip.source === 'driver' ? 'Live' : 'Demo motion'}</Text>
                    </View>
                  </View>
                  <View style={styles.busCardStats}>
                    <Stat label="ETA" value={formatMinutes(etaMinutes)} />
                    <Stat label="Speed" value={`${trip.speedKph.toFixed(0)} km/h`} />
                    <Stat label="Updated" value={formatTimeAgo(trip.lastUpdatedAt)} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No buses active on this route yet.</Text>
            <Text style={styles.emptyBody}>
              Start a trip from driver mode to see the marker appear here. The rider map is already wired for it.
            </Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Stops in order</Text>
        <View style={styles.stopList}>
          {selectedRoute.stops.map((stop, index) => (
            <Pressable
              key={stop.id}
              onPress={() => router.push({ pathname: '/(rider)/route/[routeId]', params: { routeId: selectedRoute.id } })}
              style={styles.stopRow}
            >
              <View style={[styles.stopDot, { backgroundColor: selectedRoute.color }]} />
              <View style={styles.stopTextWrap}>
                <Text style={styles.stopName}>
                  {index + 1}. {stop.name}
                </Text>
                <Text style={styles.stopLocation}>
                  {stop.location.latitude.toFixed(4)}, {stop.location.longitude.toFixed(4)}
                </Text>
              </View>
            </Pressable>
          ))}
        </View>
      </View>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 18,
    paddingBottom: 36,
    backgroundColor: '#07111D',
    minHeight: '100%',
  },
  topCard: {
    borderRadius: 30,
    padding: 20,
    backgroundColor: '#F8FAFC',
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F0FF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  badgeText: {
    color: '#1D4ED8',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  statusPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  onlinePill: {
    backgroundColor: '#DCFCE7',
  },
  offlinePill: {
    backgroundColor: '#E2E8F0',
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
  title: {
    marginTop: 14,
    fontSize: 30,
    lineHeight: 35,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 12,
    color: '#475569',
    fontSize: 15,
    lineHeight: 22,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 16,
  },
  smallButton: {
    minWidth: 130,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
  },
  secondaryButton: {
    backgroundColor: '#1D9E75',
  },
  smallButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
  routeRow: {
    gap: 10,
  },
  routeChip: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 14,
  },
  routeChipCode: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },
  routeChipText: {
    color: '#E2E8F0',
    marginTop: 4,
    fontSize: 13,
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
  busList: {
    gap: 10,
  },
  busCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#D7E2EC',
  },
  busCardSelected: {
    borderColor: '#1D9E75',
    borderWidth: 2,
  },
  busCardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  busCode: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
  },
  busDriver: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
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
  busCardStats: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  statCard: {
    flexGrow: 1,
    minWidth: 92,
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#EEF4FB',
  },
  statLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  statValue: {
    marginTop: 6,
    color: '#0F172A',
    fontSize: 15,
    fontWeight: '900',
  },
  emptyState: {
    borderRadius: 22,
    padding: 18,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
  },
  emptyTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  emptyBody: {
    marginTop: 8,
    color: '#CBD5E1',
    fontSize: 13,
    lineHeight: 20,
  },
  stopList: {
    gap: 10,
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
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
    marginTop: 4,
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
});
