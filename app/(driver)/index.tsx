import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Location from 'expo-location';
import RouteMap from '@/components/RouteMap';
import { defaultRouteId, estimateEtaMinutes, getRouteById, routes, type TripSnapshot } from '@/lib/abangbus-data';
import {
  completeRemoteTrip,
  createRemoteTrip,
  isRemoteBackendReady,
  signInWithPassword,
  signOut,
  signUpWithPassword,
  upsertRemotePosition,
} from '@/lib/supabase-transit';
import { useSupabaseSession } from '@/lib/use-session';
import {
  endDemoTrip,
  getTrips,
  pauseTripMotion,
  resumeTripMotionForTrip,
  startDemoTrip,
  subscribeToTrips,
  updateTripLocation,
} from '@/lib/demo-tracker';

export default function DriverScreen() {
  const [session] = useSupabaseSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [selectedRouteId, setSelectedRouteId] = useState(defaultRouteId);
  const [busCode, setBusCode] = useState('AB-142');
  const [driverName, setDriverName] = useState('Kuya Ben');
  const [activeTrips, setActiveTrips] = useState(getTrips());
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const [currentTrip, setCurrentTrip] = useState<TripSnapshot | null>(null);
  const [activeWatcher, setActiveWatcher] = useState<Location.LocationSubscription | null>(null);
  const [trackingLabel, setTrackingLabel] = useState('Ready to start');
  const [permissionLabel, setPermissionLabel] = useState('Location not requested yet');
  const [motionFallbackTrip, setMotionFallbackTrip] = useState<string | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);

  useEffect(() => subscribeToTrips(setActiveTrips), []);

  const selectedRoute = useMemo(() => getRouteById(selectedRouteId), [selectedRouteId]);
  const activeTrip = currentTrip;
  const activeTripRoute = activeTrip ? getRouteById(activeTrip.routeId) : selectedRoute;
  const backendReady = isRemoteBackendReady();
  const usingRemote = backendReady && Boolean(session);

  useEffect(() => {
    if (!motionFallbackTrip) {
      return;
    }

    const timer = setTimeout(() => {
      setTrackingLabel('Demo motion is keeping the trip alive.');
    }, 1500);

    return () => clearTimeout(timer);
  }, [motionFallbackTrip]);

  const handleStartTrip = async () => {
    if (!busCode.trim()) {
      setTrackingLabel('Add a bus code first.');
      return;
    }

    setBusyMessage(null);
    let remoteTripId: string | null = null;
    let demoTripId: string | null = null;

    try {
      if (usingRemote && session) {
        setTrackingLabel('Checking location permission...');

        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status !== 'granted') {
          setPermissionLabel('Location denied, switching to demo motion.');
          setTrackingLabel('Trip is live using the local demo lane.');
          const demoTrip = startDemoTrip({
            routeId: selectedRouteId,
            busCode,
            driverName,
            motionEnabled: false,
          });
          demoTripId = demoTrip.id;
          setActiveTripId(demoTrip.id);
          setCurrentTrip(demoTrip);
          resumeTripMotionForTrip(demoTrip.id);
          setMotionFallbackTrip(demoTrip.id);
          return;
        }

        const remoteTrip = await createRemoteTrip({
          routeId: selectedRouteId,
          busCode: busCode.trim().toUpperCase(),
          driverId: session.user.id,
        });
        remoteTripId = remoteTrip.id;

        setActiveTripId(remoteTrip.id);
        setCurrentTrip({
          id: remoteTrip.id,
          routeId: remoteTrip.route_id,
          busCode: remoteTrip.bus_code ?? busCode.trim().toUpperCase(),
          driverName,
          startedAt: remoteTrip.started_at,
          lastUpdatedAt: remoteTrip.started_at,
          status: 'active',
          source: 'driver',
          isMock: false,
          speedKph: 0,
          accuracyM: 0,
          bearing: 0,
          progress: 0,
          position: selectedRoute.center,
        });

        setPermissionLabel('Foreground location granted.');
        setTrackingLabel('GPS sharing is live while the trip is active.');
        setMotionFallbackTrip(null);

        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 8000,
            distanceInterval: 8,
          },
          async (location) => {
            const nextLocation = {
              latitude: location.coords.latitude,
              longitude: location.coords.longitude,
            };

            await upsertRemotePosition({
              tripId: remoteTrip.id,
              location: nextLocation,
              bearing: location.coords.heading ?? null,
              speedMps: location.coords.speed ?? null,
              accuracyM: location.coords.accuracy ?? null,
              source: 'driver',
              isMock: Boolean((location as Location.LocationObject & { mocked?: boolean }).mocked),
            });

            setCurrentTrip((trip) =>
              trip && trip.id === remoteTrip.id
                ? {
                    ...trip,
                    position: nextLocation,
                    lastUpdatedAt: new Date().toISOString(),
                  }
                : trip,
            );
          },
        );

        setActiveWatcher(watcher);
        setBusyMessage(null);
        return;
      }

      const trip = startDemoTrip({
        routeId: selectedRouteId,
        busCode,
        driverName,
        motionEnabled: false,
      });
      demoTripId = trip.id;

      setActiveTripId(trip.id);
      setCurrentTrip(trip);
      setTrackingLabel('Checking location permission...');

      if (Platform.OS === 'web') {
        setPermissionLabel('Web preview uses demo motion.');
        setTrackingLabel('Demo motion is sharing the trip on the rider map.');
        resumeTripMotionForTrip(trip.id);
        setMotionFallbackTrip(trip.id);
        return;
      }

      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status === 'granted') {
        setPermissionLabel('Foreground location granted.');
        setTrackingLabel('GPS sharing is live while the trip is active.');
        setMotionFallbackTrip(null);
        pauseTripMotion(trip.id);

        const watcher = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.High,
            timeInterval: 8000,
            distanceInterval: 8,
          },
          (location) => {
            updateTripLocation(
              trip.id,
              {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
              },
              {
                accuracyM: location.coords.accuracy ?? 12,
                speedKph: Math.max(12, Math.round(((location.coords.speed ?? 0) * 3.6 || 18) * 10) / 10),
                bearing: location.coords.heading ?? 0,
                isMock: Boolean((location as Location.LocationObject & { mocked?: boolean }).mocked),
              },
            );
            setCurrentTrip((current) =>
              current && current.id === trip.id
                ? {
                    ...current,
                    position: {
                      latitude: location.coords.latitude,
                      longitude: location.coords.longitude,
                    },
                    lastUpdatedAt: new Date().toISOString(),
                  }
                : current,
            );
          },
        );

        setActiveWatcher(watcher);
        return;
      }

      setPermissionLabel('Location denied, switching to demo motion.');
      setTrackingLabel('Trip is live using the local demo lane.');
      pauseTripMotion(trip.id);
      resumeTripMotionForTrip(trip.id);
      setMotionFallbackTrip(trip.id);
    } catch (error) {
      if (remoteTripId) {
        await completeRemoteTrip(remoteTripId).catch(() => undefined);
      }
      if (demoTripId) {
        endDemoTrip(demoTripId);
      }
      const message = error instanceof Error ? error.message : 'Unable to start the trip.';
      setBusyMessage(message);
      setTrackingLabel('Trip start failed.');
    }
  };

  const handleEndTrip = async () => {
    if (activeWatcher) {
      activeWatcher.remove();
      setActiveWatcher(null);
    }

    if (usingRemote && activeTripId && currentTrip?.source === 'driver') {
      await completeRemoteTrip(activeTripId);
    } else if (activeTripId) {
      endDemoTrip(activeTripId);
    }

    setActiveTripId(null);
    setCurrentTrip(null);
    setTrackingLabel('Trip ended.');
    setPermissionLabel('Location sharing stopped.');
    setMotionFallbackTrip(null);
  };

  const handleSignIn = async () => {
    setBusyMessage(null);
    try {
      const { error } = await signInWithPassword(email, password);
      if (error) {
        setBusyMessage(error.message);
      }
    } catch (error) {
      setBusyMessage(error instanceof Error ? error.message : 'Could not sign in.');
    }
  };

  const handleSignUp = async () => {
    setBusyMessage(null);
    try {
      const { error } = await signUpWithPassword(email, password, displayName);
      if (error) {
        setBusyMessage(error.message);
      }
    } catch (error) {
      setBusyMessage(error instanceof Error ? error.message : 'Could not sign up.');
    }
  };

  const handleLogout = async () => {
    await signOut();
  };

  const activeTripMeta = activeTrip
    ? {
        route: activeTripRoute,
        etaMinutes: estimateEtaMinutes(activeTripRoute, activeTrip.progress, activeTrip.speedKph),
      }
    : null;
  const driverTrips = currentTrip
    ? [currentTrip, ...activeTrips.filter((trip) => trip.id !== currentTrip.id && trip.routeId === selectedRouteId)]
    : activeTrips.filter((trip) => trip.routeId === selectedRouteId);

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.topCard}>
        <View style={styles.topRow}>
          <View>
            <Text style={styles.kicker}>Driver mode</Text>
            <Text style={styles.title}>Share location only while the trip is active.</Text>
          </View>
          <View style={[styles.statusPill, backendReady ? styles.onlinePill : styles.offlinePill]}>
            <Text style={styles.statusPillText}>{backendReady ? 'Supabase ready' : 'Local demo'}</Text>
          </View>
        </View>

        <Text style={styles.description}>
          This screen follows the capstone design: a driver taps start, the app shares position, and riders see the bus on the map.
        </Text>

        <View style={styles.noticeCard}>
          <Text style={styles.noticeTitle}>{trackingLabel}</Text>
          <Text style={styles.noticeBody}>{permissionLabel}</Text>
          {busyMessage ? <Text style={styles.noticeError}>{busyMessage}</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.authCard}>
          {session ? (
            <>
              <Text style={styles.authLabel}>Signed in as</Text>
              <Text style={styles.authValue}>{session.user.email}</Text>
              <Pressable style={[styles.actionButton, styles.logoutButton]} onPress={handleLogout}>
                <Text style={styles.actionButtonText}>Sign out</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.authLabel}>Sign in to use real Supabase writes</Text>
              <TextInput
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Display name"
                placeholderTextColor="#64748B"
                style={styles.input}
              />
              <TextInput
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                placeholder="Email"
                placeholderTextColor="#64748B"
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                placeholder="Password"
                placeholderTextColor="#64748B"
                style={styles.input}
              />
              <View style={styles.authRow}>
                <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={handleSignIn}>
                  <Text style={styles.actionButtonText}>Sign in</Text>
                </Pressable>
                <Pressable style={[styles.actionButton, styles.secondaryButton]} onPress={handleSignUp}>
                  <Text style={styles.actionButtonText}>Create account</Text>
                </Pressable>
              </View>
            </>
          )}
          {!backendReady ? <Text style={styles.authHint}>Set your Supabase URL and anon key to enable live writes.</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Choose a route</Text>
        <View style={styles.routeRow}>
          {routes.map((route) => {
            const selected = route.id === selectedRouteId;
            return (
              <Pressable
                key={route.id}
                onPress={() => setSelectedRouteId(route.id)}
                style={[
                  styles.routeChip,
                  {
                    backgroundColor: selected ? route.color : '#142033',
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
        <Text style={styles.sectionTitle}>Trip details</Text>
        <View style={styles.formGrid}>
          <Field label="Bus code" value={busCode} onChangeText={setBusCode} placeholder="AB-142" />
          <Field label="Driver name" value={driverName} onChangeText={setDriverName} placeholder="Kuya Ben" />
        </View>
      </View>

      <View style={styles.section}>
        <RouteMap route={selectedRoute} trips={driverTrips} selectedTripId={currentTrip?.id ?? null} />
      </View>

      <View style={styles.section}>
        <View style={styles.metricsRow}>
          <Metric label="Route" value={selectedRoute.code} />
          <Metric label="Pilot stops" value={`${selectedRoute.stops.length}`} />
          <Metric label="Live buses" value={`${driverTrips.length}`} />
        </View>
      </View>

      {activeTrip && activeTripMeta ? (
        <View style={styles.activeCard}>
          <View style={styles.activeHeader}>
            <View>
              <Text style={styles.activeLabel}>Active trip</Text>
              <Text style={styles.activeValue}>
                {activeTrip.busCode} on {activeTripMeta.route.code}
              </Text>
            </View>
            <View style={styles.liveBadge}>
              <Text style={styles.liveBadgeText}>{activeTrip.source === 'driver' ? 'Driver verified' : 'Demo motion'}</Text>
            </View>
          </View>

          <View style={styles.activeGrid}>
            <Metric label="ETA" value={`${activeTripMeta.etaMinutes} min`} />
            <Metric label="Speed" value={`${activeTrip.speedKph.toFixed(0)} km/h`} />
            <Metric label="Accuracy" value={`${Math.round(activeTrip.accuracyM)} m`} />
            <Metric label="Updated" value={new Date(activeTrip.lastUpdatedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} />
          </View>

          <View style={styles.actionRow}>
            <Pressable style={[styles.actionButton, styles.endButton]} onPress={handleEndTrip}>
              <Text style={styles.actionButtonText}>End trip</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.activeCard}>
          <Text style={styles.activeLabel}>No trip active</Text>
          <Text style={styles.activeCopy}>
            When you start a trip, this card becomes the live status view for the bus currently sharing position.
          </Text>
          <View style={styles.actionRow}>
            <Pressable style={[styles.actionButton, styles.startButton]} onPress={handleStartTrip}>
              <Text style={styles.actionButtonText}>Start trip</Text>
            </Pressable>
          </View>
        </View>
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#64748B"
        style={styles.input}
      />
    </View>
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
    flexShrink: 1,
  },
  description: {
    marginTop: 12,
    fontSize: 15,
    lineHeight: 22,
    color: '#475569',
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
  noticeCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 14,
    backgroundColor: '#0F172A',
  },
  noticeTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  noticeBody: {
    marginTop: 4,
    color: '#CBD5E1',
    fontSize: 13,
  },
  noticeError: {
    marginTop: 6,
    color: '#FCA5A5',
    fontSize: 13,
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
  authCard: {
    borderRadius: 24,
    padding: 16,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
    gap: 10,
  },
  authLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  authValue: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  authHint: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  authRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
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
  formGrid: {
    gap: 12,
  },
  field: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
  },
  fieldLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 4,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    minWidth: 92,
    padding: 14,
    borderRadius: 18,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  metricValue: {
    marginTop: 8,
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  activeCard: {
    marginTop: 18,
    borderRadius: 24,
    padding: 18,
    backgroundColor: '#F8FAFC',
  },
  activeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  activeLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    color: '#1D9E75',
    fontWeight: '800',
  },
  activeValue: {
    marginTop: 6,
    fontSize: 20,
    fontWeight: '900',
    color: '#0F172A',
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
  activeGrid: {
    marginTop: 14,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionRow: {
    marginTop: 16,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    borderRadius: 18,
    minWidth: 140,
  },
  startButton: {
    backgroundColor: '#1D9E75',
  },
  endButton: {
    backgroundColor: '#DC2626',
  },
  logoutButton: {
    backgroundColor: '#334155',
  },
  secondaryButton: {
    backgroundColor: '#2563EB',
    flexGrow: 1,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  activeCopy: {
    marginTop: 8,
    color: '#475569',
    fontSize: 14,
    lineHeight: 21,
  },
});
