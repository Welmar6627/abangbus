import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/AppBrand';
import { RiderBottomNav } from '@/components/RiderBottomNav';
import RouteMap from '@/components/RouteMap';
import {
  estimateEtaMinutes,
  formatMinutes,
  formatTimeAgo,
  getRouteById,
  routeLengthMeters,
  routes as localRoutes,
  type RouteDefinition,
  type TripSnapshot,
} from '@/lib/abangbus-data';
import { getTrips, subscribeToTrips } from '@/lib/demo-tracker';
import {
  isRemoteBackendReady,
  loadActiveTrips,
  loadFavoriteStops,
  loadPilotRoutes,
  setFavoriteStop,
} from '@/lib/supabase-transit';
import { supabase } from '@/lib/supabase';
import { useSupabaseSession } from '@/lib/use-session';
import { colors, fonts } from '@/lib/theme';

export default function RouteDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ routeId?: string }>();
  const routeId = typeof params.routeId === 'string' ? params.routeId : localRoutes[0].id;
  const [session] = useSupabaseSession();
  const [routeList, setRouteList] = useState<RouteDefinition[]>(localRoutes);
  const [trips, setTrips] = useState<TripSnapshot[]>(getTrips());
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [favoriteStopIds, setFavoriteStopIds] = useState<string[]>([]);
  const [busyStopId, setBusyStopId] = useState<string | null>(null);
  const [following, setFollowing] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
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
      const unsubscribe = subscribeToTrips(setTrips);
      return () => {
        alive = false;
        unsubscribe();
      };
    }

    const channel = supabase
      ?.channel(`abangbus-route-${routeId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'live_positions' }, refresh)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, refresh)
      .subscribe();

    return () => {
      alive = false;
      if (channel) {
        void supabase?.removeChannel(channel);
      }
    };
  }, [backendReady, routeId]);

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

  const route = routeList.find((item) => item.id === routeId) ?? getRouteById(routeId) ?? routeList[0];
  const routeTrips = trips.filter((trip) => trip.routeId === route.id && trip.status === 'active');
  const selectedTrip = routeTrips.find((trip) => trip.id === selectedTripId) ?? routeTrips[0] ?? null;
  const etaMinutes = selectedTrip ? estimateEtaMinutes(route, selectedTrip.progress, selectedTrip.speedKph) : null;
  const distanceKm = selectedTrip ? routeLengthMeters(route.path) * (1 - selectedTrip.progress) / 1000 : null;
  const confidence = selectedTrip ? Math.max(70, Math.round(100 - selectedTrip.accuracyM / 2)) : 0;

  const handleToggleFavorite = async (stopId: string) => {
    if (!session) {
      router.push('/(rider)/favorites');
      return;
    }

    setBusyStopId(stopId);
    setNotice(null);
    try {
      const isFavorite = favoriteStopIds.includes(stopId);
      await setFavoriteStop(session.user.id, stopId, !isFavorite);
      setFavoriteStopIds((current) => current.includes(stopId) ? current.filter((id) => id !== stopId) : [...current, stopId]);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Could not update this favorite.');
    } finally {
      setBusyStopId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <View style={styles.appBar}>
            <Pressable style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
              <Ionicons name="arrow-back" size={23} color={colors.ink} />
            </Pressable>
            <AppBrand compact />
            <Pressable style={styles.searchButton} onPress={() => router.replace('/(rider)/home')} accessibilityLabel="Search routes">
              <Ionicons name="search" size={25} color={colors.ink} />
            </Pressable>
          </View>

          <View style={styles.mapSection}>
            <RouteMap
              route={route}
              trips={routeTrips}
              height={405}
              selectedTripId={selectedTrip?.id ?? null}
              onSelectTrip={setSelectedTripId}
            />
            <View style={styles.routeDetailsPill}>
              <Ionicons name="git-compare-outline" size={25} color={colors.primary} />
              <View style={styles.routeDetailsTextWrap}>
                <Text style={styles.routeDetailsLabel}>Route details</Text>
                <Text style={styles.routeDetailsCode}>{route.name}</Text>
              </View>
              <Ionicons name="chevron-down" size={20} color={colors.outlineSoft} />
            </View>
          </View>

          <View style={styles.sheet}>
            <View style={styles.handle} />
            {selectedTrip ? (
              <>
                <View style={styles.busCard}>
                  <View style={styles.statusRail} />
                  <View style={styles.busHeader}>
                    <View style={styles.busIdentity}>
                      <View style={styles.busIconTile}>
                        <Ionicons name="bus" size={29} color={colors.secondary} />
                      </View>
                      <View style={styles.busIdentityText}>
                        <Text style={styles.busCode}>{selectedTrip.busCode}</Text>
                        <Text style={styles.busRoute}>{route.name}</Text>
                      </View>
                    </View>
                    <View>
                      <View style={styles.verifiedPill}>
                        <Ionicons name="shield-checkmark-outline" size={18} color={colors.secondary} />
                        <Text style={styles.verifiedText}>{confidence}% verified</Text>
                      </View>
                      <Text style={styles.confidenceLabel}>GPS confidence</Text>
                    </View>
                  </View>

                  <View style={styles.metricsRow}>
                    <Metric icon="time-outline" label="ETA" value={formatMinutes(etaMinutes ?? 1)} />
                    <Metric icon="location-outline" label="Distance" value={`${distanceKm?.toFixed(1) ?? '0'} km`} />
                  </View>

                  <View style={styles.driverRow}>
                    <View style={styles.driverAvatar}>
                      <Text style={styles.driverAvatarText}>{selectedTrip.driverName.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.driverTextWrap}>
                      <Text style={styles.driverLabel}>Driver</Text>
                      <Text style={styles.driverName}>{selectedTrip.source === 'driver' ? 'Verified driver' : selectedTrip.driverName}</Text>
                    </View>
                    <View style={styles.updatedPill}>
                      <View style={styles.liveDot} />
                      <Text style={styles.updatedText}>{formatTimeAgo(selectedTrip.lastUpdatedAt)}</Text>
                    </View>
                  </View>
                </View>

                <View style={styles.actionRow}>
                  <Pressable style={[styles.followButton, following && styles.followingButton]} onPress={() => setFollowing((current) => !current)}>
                    <Ionicons name={following ? 'checkmark-circle' : 'navigate'} size={20} color="#FFFFFF" />
                    <Text style={styles.followButtonText}>{following ? 'Following bus' : 'Follow bus'}</Text>
                  </Pressable>
                  <Pressable style={styles.reportButton} onPress={() => setNotice('Report noted locally. Production reporting will be connected to moderation before launch.')}>
                    <Text style={styles.reportButtonText}>Report location</Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <View style={styles.emptyCard}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="bus-outline" size={32} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No bus is broadcasting yet</Text>
                <Text style={styles.emptyBody}>This route is ready. A marker will appear as soon as a driver starts a live trip.</Text>
              </View>
            )}

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <View style={styles.stopHeader}>
              <View>
                <Text style={styles.stopKicker}>Ormoc–Sogod corridor</Text>
                <Text style={styles.stopTitle}>Stops in order</Text>
              </View>
              <View style={styles.stopCountPill}>
                <Text style={styles.stopCountText}>{route.stops.length} stops</Text>
              </View>
            </View>
            <View style={styles.stopList}>
              {route.stops.map((stop, index) => {
                const favorite = favoriteStopIds.includes(stop.id);
                return (
                  <Pressable key={stop.id} onPress={() => void handleToggleFavorite(stop.id)} style={styles.stopRow}>
                    <View style={styles.stopTrack}>
                      <View style={[styles.stopDot, index === 0 && styles.stopDotActive]} />
                      {index < route.stops.length - 1 ? <View style={styles.stopLine} /> : null}
                    </View>
                    <View style={styles.stopTextWrap}>
                      <Text style={styles.stopName}>{stop.name}</Text>
                      <Text style={styles.stopLocation}>{stop.location.latitude.toFixed(4)}, {stop.location.longitude.toFixed(4)}</Text>
                    </View>
                    <View style={[styles.favoriteButton, favorite && styles.favoriteButtonActive]}>
                      {busyStopId === stop.id ? (
                        <ActivityIndicator size="small" color={favorite ? '#FFFFFF' : colors.primary} />
                      ) : (
                        <Ionicons name={favorite ? 'star' : 'star-outline'} size={19} color={favorite ? '#FFFFFF' : colors.primary} />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
        <RiderBottomNav active="map" />
      </View>
    </SafeAreaView>
  );
}

type MetricProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  value: string;
};

function Metric({ icon, label, value }: MetricProps) {
  return (
    <View style={styles.metricCard}>
      <Ionicons name={icon} size={28} color={colors.primary} />
      <View>
        <Text style={styles.metricLabel}>{label}</Text>
        <Text style={styles.metricValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  page: { paddingBottom: 0 },
  appBar: { height: 70, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'rgba(248,249,255,0.98)' },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  searchButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  mapSection: { paddingHorizontal: 0, backgroundColor: colors.surfaceContainer },
  routeDetailsPill: { position: 'absolute', top: 18, right: 18, maxWidth: '72%', minHeight: 66, paddingHorizontal: 18, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.96)', flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 14, elevation: 5 },
  routeDetailsTextWrap: { flex: 1 },
  routeDetailsLabel: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15, textTransform: 'capitalize' },
  routeDetailsCode: { marginTop: 2, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 10 },
  sheet: { marginTop: -24, paddingHorizontal: 18, paddingTop: 14, paddingBottom: 28, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: colors.surface, zIndex: 2 },
  handle: { width: 58, height: 6, borderRadius: 3, backgroundColor: '#E4E7EC', alignSelf: 'center', marginBottom: 18 },
  busCard: { position: 'relative', padding: 18, borderRadius: 24, backgroundColor: colors.surfaceLow, overflow: 'hidden' },
  statusRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5, backgroundColor: colors.secondary },
  busHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  busIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  busIconTile: { width: 54, height: 54, borderRadius: 16, backgroundColor: '#D9ECE7', alignItems: 'center', justifyContent: 'center' },
  busIdentityText: { flex: 1 },
  busCode: { color: colors.ink, fontFamily: fonts.bold, fontSize: 22 },
  busRoute: { marginTop: 3, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  verifiedPill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999, backgroundColor: colors.secondarySoft },
  verifiedText: { color: colors.secondary, fontFamily: fonts.semibold, fontSize: 11 },
  confidenceLabel: { marginTop: 5, color: colors.outline, fontFamily: fonts.regular, fontSize: 9, textAlign: 'center' },
  metricsRow: { flexDirection: 'row', gap: 12, marginTop: 18 },
  metricCard: { flex: 1, minHeight: 88, padding: 14, borderRadius: 18, backgroundColor: colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  metricLabel: { color: colors.outline, fontFamily: fonts.regular, fontSize: 11 },
  metricValue: { marginTop: 2, color: colors.primary, fontFamily: fonts.semibold, fontSize: 16 },
  driverRow: { marginTop: 18, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outlineSoft, flexDirection: 'row', alignItems: 'center', gap: 10 },
  driverAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  driverAvatarText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 17 },
  driverTextWrap: { flex: 1 },
  driverLabel: { color: colors.outline, fontFamily: fonts.regular, fontSize: 11 },
  driverName: { marginTop: 2, color: colors.ink, fontFamily: fonts.semibold, fontSize: 13 },
  updatedPill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  updatedText: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 10 },
  actionRow: { marginTop: 16, flexDirection: 'row', gap: 12 },
  followButton: { flex: 1, minHeight: 54, borderRadius: 27, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  followingButton: { backgroundColor: colors.secondary },
  followButtonText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 13 },
  reportButton: { flex: 1, minHeight: 54, borderRadius: 27, borderWidth: 1.5, borderColor: colors.outlineSoft, alignItems: 'center', justifyContent: 'center' },
  reportButtonText: { color: colors.inkMuted, fontFamily: fonts.semibold, fontSize: 12 },
  emptyCard: { alignItems: 'center', padding: 22, borderRadius: 22, backgroundColor: colors.surfaceLow },
  emptyIcon: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { marginTop: 14, color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 },
  emptyBody: { marginTop: 7, maxWidth: 290, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  notice: { marginTop: 12, padding: 11, borderRadius: 12, backgroundColor: colors.surfaceContainer, color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  stopHeader: { marginTop: 26, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  stopKicker: { color: colors.primary, fontFamily: fonts.medium, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase' },
  stopTitle: { marginTop: 4, color: colors.ink, fontFamily: fonts.semibold, fontSize: 19 },
  stopCountPill: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 999, backgroundColor: colors.primarySoft },
  stopCountText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 10 },
  stopList: { gap: 0 },
  stopRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 12 },
  stopTrack: { width: 20, height: 72, alignItems: 'center' },
  stopDot: { marginTop: 27, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.outlineSoft, zIndex: 2 },
  stopDotActive: { backgroundColor: colors.secondary, borderWidth: 3, borderColor: colors.secondarySoft, width: 16, height: 16, borderRadius: 8, marginTop: 25 },
  stopLine: { position: 'absolute', top: 37, bottom: -35, width: 2, backgroundColor: colors.primarySoft },
  stopTextWrap: { flex: 1 },
  stopName: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 13 },
  stopLocation: { marginTop: 3, color: colors.outline, fontFamily: fonts.regular, fontSize: 10 },
  favoriteButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  favoriteButtonActive: { backgroundColor: colors.primary },
});
