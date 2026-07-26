import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/AppBrand';
import RouteMap from '@/components/RouteMap';
import {
  estimateEtaMinutes,
  routes as localRoutes,
  type RouteDefinition,
  type TripSnapshot,
} from '@/lib/abangbus-data';
import {
  endDemoTrip,
  getTrips,
  pauseTripMotion,
  resumeTripMotionForTrip,
  startDemoTrip,
  subscribeToTrips,
  updateTripLocation,
} from '@/lib/demo-tracker';
import {
  completeRemoteTrip,
  createRemoteTrip,
  isRemoteBackendReady,
  loadCurrentProfile,
  loadPilotRoutes,
  signOut,
  upsertRemotePosition,
  type UserProfile,
} from '@/lib/supabase-transit';
import { useSupabaseSession } from '@/lib/use-session';
import { colors, fonts } from '@/lib/theme';
import { normalizeBusCode, validateBusCode } from '@/lib/input-validation';

export default function DriverScreen() {
  const router = useRouter();
  const [session] = useSupabaseSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [routeList, setRouteList] = useState<RouteDefinition[]>(localRoutes);
  const [selectedRouteId, setSelectedRouteId] = useState(localRoutes[0].id);
  const [busCode, setBusCode] = useState('AB-142');
  const [activeTrips, setActiveTrips] = useState(getTrips());
  const [currentTrip, setCurrentTrip] = useState<TripSnapshot | null>(null);
  const [watcher, setWatcher] = useState<Location.LocationSubscription | null>(null);
  const [permissionLabel, setPermissionLabel] = useState('GPS permission will be requested when you start.');
  const [statusLabel, setStatusLabel] = useState('Ready for dispatch');
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const backendReady = isRemoteBackendReady();

  useEffect(() => subscribeToTrips(setActiveTrips), []);

  useEffect(() => {
    return () => watcher?.remove();
  }, [watcher]);

  useEffect(() => {
    let active = true;
    const prepare = async () => {
      setCheckingAccess(true);
      try {
        const routes = backendReady ? await loadPilotRoutes() : localRoutes;
        if (!active) return;
        setRouteList(routes);
        if (routes[0]) setSelectedRouteId(routes[0].id);

        if (backendReady && session) {
          const nextProfile = await loadCurrentProfile(session.user.id);
          if (!active) return;
          setProfile(nextProfile);
        } else {
          setProfile(null);
        }
      } catch (error) {
        if (active) setErrorMessage(error instanceof Error ? error.message : 'Unable to verify driver access.');
      } finally {
        if (active) setCheckingAccess(false);
      }
    };
    void prepare();
    return () => { active = false; };
  }, [backendReady, session]);

  const selectedRoute = routeList.find((route) => route.id === selectedRouteId) ?? routeList[0] ?? localRoutes[0];
  const approvedDriver = profile?.role === 'driver' || profile?.role === 'admin';
  const driverName = profile?.displayName || session?.user.email?.split('@')[0] || 'Demo driver';
  const routeTrips = currentTrip
    ? [currentTrip, ...activeTrips.filter((trip) => trip.id !== currentTrip.id && trip.routeId === selectedRoute.id)]
    : activeTrips.filter((trip) => trip.routeId === selectedRoute.id);

  const startTrip = async () => {
    const busCodeError = validateBusCode(busCode);
    if (busCodeError) {
      setErrorMessage(busCodeError);
      return;
    }
    if (backendReady && (!session || !approvedDriver)) {
      setErrorMessage('This account is not approved for driver dispatch.');
      return;
    }

    setBusy(true);
    setErrorMessage(null);
    setStatusLabel('Checking GPS...');
    let createdTripId: string | null = null;

    try {
      if (Platform.OS !== 'web') {
        const servicesEnabled = await Location.hasServicesEnabledAsync();
        if (!servicesEnabled) throw new Error('Turn on device location services before starting the trip.');
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted' && backendReady) {
        throw new Error('Location permission is required for a live driver trip. No trip was started.');
      }

      if (backendReady && session) {
        const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        const remoteTrip = await createRemoteTrip({
          routeId: selectedRoute.id,
          busCode,
        });
        createdTripId = remoteTrip.id;
        const initialPosition = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
        await upsertRemotePosition({
          tripId: remoteTrip.id,
          location: initialPosition,
          bearing: initial.coords.heading,
          speedMps: initial.coords.speed,
          accuracyM: initial.coords.accuracy,
        });

        const trip: TripSnapshot = {
          id: remoteTrip.id,
          routeId: remoteTrip.route_id,
          busCode: remoteTrip.bus_code ?? normalizeBusCode(busCode),
          driverName,
          startedAt: remoteTrip.started_at,
          lastUpdatedAt: new Date().toISOString(),
          status: 'active',
          source: 'driver',
          isMock: false,
          speedKph: Math.max(0, (initial.coords.speed ?? 0) * 3.6),
          accuracyM: initial.coords.accuracy ?? 0,
          bearing: initial.coords.heading ?? 0,
          progress: 0,
          position: initialPosition,
        };
        setCurrentTrip(trip);

        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 8 },
          (location) => {
            const nextPosition = { latitude: location.coords.latitude, longitude: location.coords.longitude };
            void upsertRemotePosition({
              tripId: remoteTrip.id,
              location: nextPosition,
              bearing: location.coords.heading,
              speedMps: location.coords.speed,
              accuracyM: location.coords.accuracy,
              isMock: Boolean((location as Location.LocationObject & { mocked?: boolean }).mocked),
            }).catch(() => setErrorMessage('A GPS update failed. The app will retry on the next reading.'));
            setCurrentTrip((current) => current?.id === remoteTrip.id ? {
              ...current,
              position: nextPosition,
              speedKph: Math.max(0, (location.coords.speed ?? 0) * 3.6),
              accuracyM: location.coords.accuracy ?? 0,
              bearing: location.coords.heading ?? 0,
              lastUpdatedAt: new Date().toISOString(),
            } : current);
          },
        );
        setWatcher(subscription);
        setPermissionLabel('High-accuracy foreground GPS is active.');
        setStatusLabel('Live and visible to riders');
        return;
      }

      const trip = startDemoTrip({ routeId: selectedRoute.id, busCode, driverName, motionEnabled: false });
      createdTripId = trip.id;
      setCurrentTrip(trip);
      if (Platform.OS === 'web' || permission.status !== 'granted') {
        resumeTripMotionForTrip(trip.id);
        setPermissionLabel('Demo route motion is active.');
      } else {
        pauseTripMotion(trip.id);
        const subscription = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.High, timeInterval: 8000, distanceInterval: 8 },
          (location) => {
            const nextPosition = { latitude: location.coords.latitude, longitude: location.coords.longitude };
            updateTripLocation(trip.id, nextPosition, {
              accuracyM: location.coords.accuracy ?? 0,
              speedKph: Math.max(0, (location.coords.speed ?? 0) * 3.6),
              bearing: location.coords.heading ?? 0,
            });
            setCurrentTrip((current) => current?.id === trip.id ? { ...current, position: nextPosition, lastUpdatedAt: new Date().toISOString() } : current);
          },
        );
        setWatcher(subscription);
        setPermissionLabel('Local GPS preview is active.');
      }
      setStatusLabel('Demo trip active');
    } catch (error) {
      if (createdTripId) {
        if (backendReady) await completeRemoteTrip(createdTripId).catch(() => undefined);
        else endDemoTrip(createdTripId);
      }
      setStatusLabel('Ready for dispatch');
      setErrorMessage(error instanceof Error ? error.message : 'Unable to start this trip.');
    } finally {
      setBusy(false);
    }
  };

  const endTrip = async () => {
    if (!currentTrip) return;
    setBusy(true);
    setErrorMessage(null);
    try {
      watcher?.remove();
      setWatcher(null);
      if (backendReady && currentTrip.source === 'driver') await completeRemoteTrip(currentTrip.id);
      else endDemoTrip(currentTrip.id);
      setCurrentTrip(null);
      setStatusLabel('Trip completed');
      setPermissionLabel('Location sharing has stopped.');
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unable to end the trip.');
    } finally {
      setBusy(false);
    }
  };

  if (checkingAccess) {
    return <CenteredState icon="shield-checkmark-outline" title="Verifying driver access" body="Checking your assigned role and route data." loading />;
  }

  if (backendReady && !session) {
    return <CenteredState icon="log-in-outline" title="Driver sign-in required" body="Use the approved operator account provided by your dispatcher." action="Go to sign in" onPress={() => router.replace('/login')} />;
  }

  if (backendReady && !approvedDriver) {
    return <CenteredState icon="lock-closed-outline" title="Driver access pending" body="This is a rider account. Ask an AbangBus administrator to approve it as a driver before dispatch." action="Back to rider app" onPress={() => router.replace('/(rider)/home')} secondaryAction="Sign out" onSecondaryPress={() => void signOut().then(() => router.replace('/login'))} />;
  }

  const eta = currentTrip ? estimateEtaMinutes(selectedRoute, currentTrip.progress, currentTrip.speedKph) : null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
        <View style={styles.appBar}>
          <AppBrand compact />
        </View>

        <View style={styles.hero}>
          <View style={styles.heroTop}>
            <View>
              <Text style={styles.eyebrow}>Driver console</Text>
              <Text style={styles.heroTitle}>Good day, {driverName}</Text>
            </View>
            <View style={[styles.statusBadge, currentTrip ? styles.statusBadgeLive : styles.statusBadgeReady]}>
              <View style={[styles.statusDot, currentTrip && styles.statusDotLive]} />
              <Text style={styles.statusBadgeText}>{currentTrip ? 'ON TRIP' : 'READY'}</Text>
            </View>
          </View>
          <Text style={styles.heroStatus}>{statusLabel}</Text>
          <Text style={styles.heroHint}>{permissionLabel}</Text>
          {errorMessage ? <View style={styles.errorBox}><Ionicons name="alert-circle" size={18} color={colors.error} /><Text style={styles.errorText}>{errorMessage}</Text></View> : null}
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={styles.sectionKicker}>Assignment</Text>
            <Text style={styles.sectionTitle}>Ormoc–Sogod service</Text>
          </View>
          <View style={styles.backendBadge}>
            <Ionicons name={backendReady ? 'cloud-done-outline' : 'flask-outline'} size={16} color={backendReady ? colors.secondary : colors.amber} />
            <Text style={styles.backendText}>{backendReady ? 'Supabase live' : 'Demo mode'}</Text>
          </View>
        </View>

        <View style={styles.assignmentCard}>
          <Text style={styles.inputLabel}>Assigned route</Text>
          <View style={styles.routeRow}>
            {routeList.map((route) => (
              <Pressable key={route.id} disabled={Boolean(currentTrip)} onPress={() => setSelectedRouteId(route.id)} style={[styles.routeChoice, selectedRoute.id === route.id && styles.routeChoiceSelected]}>
                <View style={[styles.routeIcon, { backgroundColor: route.color }]}><Ionicons name="bus" size={20} color="#FFFFFF" /></View>
                <View style={styles.routeTextWrap}><Text style={styles.routeCode}>{route.code}</Text><Text style={styles.routeName}>{route.name}</Text></View>
                {selectedRoute.id === route.id ? <Ionicons name="checkmark-circle" size={24} color={colors.secondary} /> : null}
              </Pressable>
            ))}
          </View>
          <Text style={styles.inputLabel}>Bus code</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="keypad-outline" size={21} color={colors.outline} />
            <TextInput value={busCode} onChangeText={setBusCode} editable={!currentTrip} autoCapitalize="characters" autoCorrect={false} maxLength={20} accessibilityLabel="Assigned bus code" placeholder="AB-142" placeholderTextColor={colors.outlineSoft} style={styles.input} />
          </View>
        </View>

        <View style={styles.mapCard}>
          <RouteMap route={selectedRoute} trips={routeTrips} selectedTripId={currentTrip?.id ?? null} height={280} />
          <View style={styles.mapOverlay}><Ionicons name="navigate" size={15} color={colors.primary} /><Text style={styles.mapOverlayText}>{currentTrip ? 'Your live position' : `${selectedRoute.stops.length} pilot stops`}</Text></View>
        </View>

        <View style={styles.metricsRow}>
          <Metric icon="speedometer-outline" label="Speed" value={`${Math.round(currentTrip?.speedKph ?? 0)} km/h`} />
          <Metric icon="locate-outline" label="GPS" value={currentTrip ? `${Math.round(currentTrip.accuracyM)} m` : 'Standby'} />
          <Metric icon="time-outline" label="ETA" value={eta === null ? '--' : `${eta} min`} />
        </View>

        <Pressable disabled={busy} onPress={() => void (currentTrip ? endTrip() : startTrip())} style={({ pressed }) => [styles.dispatchButton, currentTrip && styles.endButton, pressed && styles.buttonPressed, busy && styles.buttonDisabled]}>
          {busy ? <ActivityIndicator color="#FFFFFF" /> : <><Ionicons name={currentTrip ? 'stop-circle' : 'play-circle'} size={25} color="#FFFFFF" /><Text style={styles.dispatchButtonText}>{currentTrip ? 'End trip and stop sharing' : 'Start trip and share location'}</Text></>}
        </Pressable>
        <Text style={styles.privacyText}><Ionicons name="shield-checkmark-outline" size={13} /> Location is shared only during an active trip.</Text>

        {session ? <Pressable style={styles.signOutButton} onPress={() => void signOut().then(() => router.replace('/login'))}><Ionicons name="log-out-outline" size={18} color={colors.inkMuted} /><Text style={styles.signOutText}>Sign out {session.user.email}</Text></Pressable> : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function Metric({ icon, label, value }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string; value: string }) {
  return <View style={styles.metric}><Ionicons name={icon} size={20} color={colors.primary} /><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>;
}

function CenteredState({ icon, title, body, loading, action, onPress, secondaryAction, onSecondaryPress }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; body: string; loading?: boolean; action?: string; onPress?: () => void; secondaryAction?: string; onSecondaryPress?: () => void }) {
  return <SafeAreaView style={styles.stateSafe}><View style={styles.stateGlow} /><View style={styles.stateCard}><View style={styles.stateIcon}><Ionicons name={icon} size={38} color={colors.primary} /></View><AppBrand compact /><Text style={styles.stateTitle}>{title}</Text><Text style={styles.stateBody}>{body}</Text>{loading ? <ActivityIndicator color={colors.primary} style={styles.stateLoader} /> : null}{action ? <Pressable style={styles.stateAction} onPress={onPress}><Text style={styles.stateActionText}>{action}</Text></Pressable> : null}{secondaryAction ? <Pressable style={styles.stateSecondary} onPress={onSecondaryPress}><Text style={styles.stateSecondaryText}>{secondaryAction}</Text></Pressable> : null}</View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { paddingHorizontal: 18, paddingBottom: 34 },
  appBar: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hero: { padding: 21, borderRadius: 26, backgroundColor: colors.primary, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: '#CFE3FF', fontFamily: fonts.medium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.1 },
  heroTitle: { marginTop: 7, color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 23, letterSpacing: -0.4 },
  heroStatus: { marginTop: 22, color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 16 },
  heroHint: { marginTop: 5, color: '#D3E4FF', fontFamily: fonts.regular, fontSize: 12, lineHeight: 18 },
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 999 },
  statusBadgeReady: { backgroundColor: 'rgba(255,255,255,0.14)' },
  statusBadgeLive: { backgroundColor: colors.secondarySoft },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FFFFFF' },
  statusDotLive: { backgroundColor: colors.secondary },
  statusBadgeText: { color: colors.ink, fontFamily: fonts.bold, fontSize: 10, letterSpacing: 0.7 },
  errorBox: { marginTop: 14, flexDirection: 'row', gap: 8, padding: 11, borderRadius: 12, backgroundColor: colors.errorSoft },
  errorText: { flex: 1, color: colors.error, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16 },
  sectionHeader: { marginTop: 24, marginBottom: 12, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 },
  sectionKicker: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
  sectionTitle: { marginTop: 4, color: colors.ink, fontFamily: fonts.semibold, fontSize: 19 },
  backendBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backendText: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 10 },
  assignmentCard: { padding: 17, borderRadius: 23, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.05, shadowRadius: 15, elevation: 2 },
  inputLabel: { marginBottom: 9, color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  routeRow: { gap: 9, marginBottom: 18 },
  routeChoice: { minHeight: 66, padding: 10, borderRadius: 17, borderWidth: 1, borderColor: colors.outlineSoft, flexDirection: 'row', alignItems: 'center', gap: 11 },
  routeChoiceSelected: { borderColor: colors.secondary, backgroundColor: '#EFFBEF' },
  routeIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  routeTextWrap: { flex: 1 },
  routeCode: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 13 },
  routeName: { marginTop: 3, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 11 },
  inputWrap: { minHeight: 55, borderRadius: 15, backgroundColor: colors.surfaceLow, borderWidth: 1, borderColor: colors.outlineSoft, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  input: { flex: 1, color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  mapCard: { marginTop: 18, borderRadius: 26, overflow: 'hidden', backgroundColor: colors.surface },
  mapOverlay: { position: 'absolute', left: 14, bottom: 14, flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.94)' },
  mapOverlayText: { color: colors.ink, fontFamily: fonts.medium, fontSize: 10 },
  metricsRow: { flexDirection: 'row', gap: 10, marginTop: 16 },
  metric: { flex: 1, minHeight: 96, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 4 },
  metricValue: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 14 },
  metricLabel: { color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 10 },
  dispatchButton: { minHeight: 62, marginTop: 20, borderRadius: 999, backgroundColor: colors.secondary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, shadowColor: colors.secondary, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4 },
  endButton: { backgroundColor: colors.error, shadowColor: colors.error },
  dispatchButtonText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 15 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  buttonDisabled: { opacity: 0.65 },
  privacyText: { marginTop: 11, textAlign: 'center', color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 10 },
  signOutButton: { marginTop: 24, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  signOutText: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 11 },
  stateSafe: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 22, overflow: 'hidden' },
  stateGlow: { position: 'absolute', width: 360, height: 360, borderRadius: 180, top: -160, right: -170, backgroundColor: colors.primarySoft, opacity: 0.75 },
  stateCard: { width: '100%', maxWidth: 430, padding: 25, borderRadius: 28, backgroundColor: colors.surface, alignItems: 'center', shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 22, elevation: 4 },
  stateIcon: { width: 76, height: 76, borderRadius: 22, marginBottom: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  stateTitle: { marginTop: 22, color: colors.ink, fontFamily: fonts.semibold, fontSize: 22, textAlign: 'center' },
  stateBody: { marginTop: 9, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20, textAlign: 'center' },
  stateLoader: { marginTop: 20 },
  stateAction: { width: '100%', minHeight: 56, marginTop: 22, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  stateActionText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 15 },
  stateSecondary: { marginTop: 15, padding: 8 },
  stateSecondaryText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 },
});
