import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { AppBrand } from '@/components/AppBrand';
import { RiderBottomNav } from '@/components/RiderBottomNav';
import RouteMap from '@/components/RouteMap';
import {
  distanceMeters,
  estimateEtaMinutes,
  formatMinutes,
  getRouteById,
  routes as localRoutes,
  type BusStop,
} from '@/lib/abangbus-data';
import { useSupabaseSession } from '@/lib/use-session';
import { useLiveTransit } from '@/lib/use-live-transit';
import { colors, fonts } from '@/lib/theme';

type NearestStop = {
  stop: BusStop;
  distance: number | null;
};

export default function HomeDashboardScreen() {
  const router = useRouter();
  const [session] = useSupabaseSession();
  const { trips, routes: routeList, backendReady, loading: transitLoading, error: transitError } = useLiveTransit('abangbus-home-live');
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState<string | null>(null);
  const [nearestStop, setNearestStop] = useState<NearestStop>({ stop: localRoutes[0].stops[0], distance: null });
  const route = routeList[0] ?? getRouteById(localRoutes[0].id);
  const routeTrips = trips.filter((trip) => trip.routeId === route.id && trip.status === 'active');
  const nextTrip = routeTrips
    .map((trip) => ({ trip, etaMinutes: estimateEtaMinutes(route, trip.progress, trip.speedKph) }))
    .sort((left, right) => left.etaMinutes - right.etaMinutes)[0];
  const displayName = session?.user.user_metadata?.display_name?.trim() || 'Rider';

  const openRoute = () => router.push({ pathname: '/(rider)/route/[routeId]', params: { routeId: route.id } });

  const locateNearestStop = async () => {
    setLocating(true);
    setLocationNotice(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        setLocationNotice('Location permission was not granted. You can still browse every stop.');
        return;
      }

      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const currentLocation = { latitude: position.coords.latitude, longitude: position.coords.longitude };
      const candidates = routeList.flatMap((candidateRoute) => candidateRoute.stops);
      const closest = candidates
        .map((stop) => ({ stop, distance: distanceMeters(currentLocation, stop.location) }))
        .sort((left, right) => left.distance - right.distance)[0];
      if (closest) {
        setNearestStop(closest);
        setLocationNotice('Nearest stop updated from your current location.');
      }
    } catch {
      setLocationNotice('We could not get your location. Check that GPS is enabled and try again.');
    } finally {
      setLocating(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <View style={styles.appBar}>
            <AppBrand compact />
            <View style={styles.appBarActions}>
              <View style={styles.notificationButton}>
                <Ionicons name="notifications-outline" size={22} color={colors.ink} />
                {routeTrips.length ? <View style={styles.notificationDot} /> : null}
              </View>
              <Pressable style={styles.avatar} onPress={() => router.push('/(rider)/favorites')} accessibilityLabel="Open account and favorites">
                <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.welcomeBlock}>
            <Text style={styles.greeting}>Good day, {displayName}!</Text>
            <Text style={styles.greetingSubtitle}>Where would you like to go today?</Text>
          </View>

          <Pressable style={styles.searchBar} onPress={openRoute} accessibilityRole="button">
            <Ionicons name="search-outline" size={22} color={colors.outline} />
            <Text style={styles.searchText}>Search destination, bus or route...</Text>
            <Ionicons name="navigate" size={20} color={colors.primary} />
          </Pressable>

          <View style={styles.liveCard}>
            <View style={styles.liveStatusRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveStatusText}>{routeTrips.length} {routeTrips.length === 1 ? 'bus' : 'buses'} online</Text>
            </View>
            <Text style={styles.sectionHeadline}>Live Fleet Status</Text>
            <Pressable style={styles.arrivalChip} onPress={openRoute}>
              <Ionicons name="time-outline" size={22} color="#FFFFFF" />
              <View>
                <Text style={styles.arrivalLabel}>Next arrival: {nextTrip ? formatMinutes(nextTrip.etaMinutes) : 'Awaiting driver'}</Text>
                <Text style={styles.arrivalRoute}>{route.name}</Text>
              </View>
            </Pressable>
            <View style={styles.mapWrap}>
              <RouteMap route={route} trips={routeTrips} height={235} selectedTripId={nextTrip?.trip.id ?? null} />
              <View style={styles.trackingToast}>
                <View style={styles.liveDot} />
                <Text style={styles.trackingToastText}>
                  {transitLoading
                    ? 'Connecting to live fleet...'
                    : transitError
                      ? 'Live fleet connection interrupted'
                      : backendReady
                        ? 'Tracking active: Supabase realtime'
                        : 'Tracking active: Local demo fleet'}
                </Text>
              </View>
            </View>
          </View>

          <Pressable style={styles.terminalCard} onPress={() => void locateNearestStop()}>
            <View style={styles.terminalPin}>
              <Ionicons name="location" size={75} color="rgba(255,255,255,0.12)" />
            </View>
            <Text style={styles.terminalKicker}>Nearest terminal</Text>
            <Text style={styles.terminalName}>{nearestStop.stop.name}</Text>
            <View style={styles.terminalDistanceRow}>
              {locating ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Ionicons name="walk-outline" size={20} color="#FFFFFF" />}
              <Text style={styles.terminalDistance}>
                {nearestStop.distance === null ? 'Tap to use your location' : `${Math.max(1, Math.round(nearestStop.distance / 80))} mins away (${formatDistance(nearestStop.distance)})`}
              </Text>
            </View>
            <View style={styles.terminalDivider} />
            <View style={styles.terminalFooter}>
              <Text style={styles.terminalFooterText}>Find nearest stop</Text>
              <Ionicons name="arrow-forward" size={22} color="#FFFFFF" />
            </View>
          </Pressable>

          {locationNotice ? <Text style={styles.locationNotice}>{locationNotice}</Text> : null}

          <View style={styles.serviceAlert}>
            <View style={styles.alertIcon}>
              <Ionicons name="megaphone" size={18} color="#FFFFFF" />
            </View>
            <Text style={styles.alertText}>Pilot service is focused on the Ormoc–Sogod corridor.</Text>
          </View>

          <Text style={styles.quickTitle}>Quick Actions</Text>
          <View style={styles.quickGrid}>
            <QuickAction icon="compass-outline" label="Locate Bus" tone="blue" onPress={openRoute} />
            <QuickAction icon="git-compare-outline" label="Nearby Stops" tone="green" onPress={() => void locateNearestStop()} />
            <QuickAction icon="star-outline" label="Favorites" tone="amber" onPress={() => router.push('/(rider)/favorites')} />
          </View>
        </ScrollView>
        <RiderBottomNav active="home" />
      </View>
    </SafeAreaView>
  );
}

function formatDistance(distance: number) {
  return distance >= 1000 ? `${(distance / 1000).toFixed(1)} km` : `${Math.round(distance)} m`;
}

type QuickActionProps = {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  label: string;
  tone: 'blue' | 'green' | 'amber';
  onPress: () => void;
};

function QuickAction({ icon, label, tone, onPress }: QuickActionProps) {
  const toneStyle = {
    blue: styles.quickIconBlue,
    green: styles.quickIconGreen,
    amber: styles.quickIconAmber,
  }[tone];
  const iconColor = { blue: colors.primary, green: colors.secondary, amber: colors.amber }[tone];

  return (
    <Pressable style={({ pressed }) => [styles.quickCard, pressed && styles.quickCardPressed]} onPress={onPress}>
      <View style={[styles.quickIcon, toneStyle]}>
        <Ionicons name={icon} size={28} color={iconColor} />
      </View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  page: { paddingHorizontal: 18, paddingBottom: 28 },
  appBar: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  appBarActions: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  notificationButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  notificationDot: { position: 'absolute', top: 7, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: colors.error },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primarySoft, borderWidth: 2, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.primary, fontFamily: fonts.bold, fontSize: 18 },
  welcomeBlock: { marginTop: 12 },
  greeting: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 24, letterSpacing: -0.4 },
  greetingSubtitle: { marginTop: 3, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 14 },
  searchBar: { minHeight: 58, marginTop: 24, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 29, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 14, elevation: 2 },
  searchText: { flex: 1, color: colors.outline, fontFamily: fonts.regular, fontSize: 14 },
  liveCard: { marginTop: 24, padding: 18, borderRadius: 26, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 18, elevation: 3 },
  liveStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.secondary },
  liveStatusText: { color: colors.secondary, fontFamily: fonts.medium, fontSize: 12 },
  sectionHeadline: { marginTop: 7, color: colors.ink, fontFamily: fonts.semibold, fontSize: 20 },
  arrivalChip: { alignSelf: 'flex-start', marginTop: 15, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 14, backgroundColor: colors.primaryBright, flexDirection: 'row', alignItems: 'center', gap: 10 },
  arrivalLabel: { color: '#EAF1FF', fontFamily: fonts.medium, fontSize: 10 },
  arrivalRoute: { marginTop: 2, color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 13 },
  mapWrap: { marginTop: 16, borderRadius: 22, overflow: 'hidden' },
  trackingToast: { position: 'absolute', left: 16, right: 16, bottom: 12, minHeight: 38, paddingHorizontal: 13, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.94)', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, shadowColor: '#000000', shadowOpacity: 0.08, shadowRadius: 8 },
  trackingToastText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 10 },
  terminalCard: { marginTop: 20, padding: 22, borderRadius: 24, backgroundColor: colors.primary, overflow: 'hidden', shadowColor: colors.primary, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  terminalPin: { position: 'absolute', right: 8, top: -2 },
  terminalKicker: { color: '#D3E4FF', fontFamily: fonts.medium, fontSize: 10, letterSpacing: 1.1, textTransform: 'uppercase' },
  terminalName: { marginTop: 9, maxWidth: '80%', color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 21 },
  terminalDistanceRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  terminalDistance: { color: '#FFFFFF', fontFamily: fonts.regular, fontSize: 13 },
  terminalDivider: { height: StyleSheet.hairlineWidth, marginVertical: 18, backgroundColor: 'rgba(255,255,255,0.28)' },
  terminalFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  terminalFooterText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 13 },
  locationNotice: { marginTop: 10, color: colors.inkMuted, backgroundColor: colors.surfaceContainer, padding: 11, borderRadius: 12, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  serviceAlert: { marginTop: 18, padding: 14, borderRadius: 18, backgroundColor: colors.surfaceContainer, flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.primarySoft },
  alertIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.amber, alignItems: 'center', justifyContent: 'center' },
  alertText: { flex: 1, color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  quickTitle: { marginTop: 22, marginBottom: 13, color: colors.ink, fontFamily: fonts.semibold, fontSize: 16 },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  quickCard: { width: '47.8%', minHeight: 138, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 13, shadowColor: '#000000', shadowOpacity: 0.035, shadowRadius: 12, elevation: 2 },
  quickCardPressed: { transform: [{ scale: 0.98 }], opacity: 0.9 },
  quickIcon: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  quickIconBlue: { backgroundColor: colors.primarySoft },
  quickIconGreen: { backgroundColor: colors.secondarySoft },
  quickIconAmber: { backgroundColor: colors.amberSoft },
  quickLabel: { color: colors.ink, fontFamily: fonts.medium, fontSize: 13 },
});
