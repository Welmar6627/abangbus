import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/AppBrand';
import { RiderBottomNav } from '@/components/RiderBottomNav';
import { routes as localRoutes } from '@/lib/abangbus-data';
import { isRemoteBackendReady, loadFavoriteStops, setFavoriteStop, type FavoriteStopRecord } from '@/lib/supabase-transit';
import { signOut } from '@/lib/supabase-auth';
import { useSupabaseSession } from '@/lib/use-session';
import { colors, fonts } from '@/lib/theme';

export default function FavoritesScreen() {
  const router = useRouter();
  const [session] = useSupabaseSession();
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStopRecord[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const backendReady = isRemoteBackendReady();

  useEffect(() => {
    if (!backendReady || !session) {
      setFavoriteStops([]);
      return;
    }

    let alive = true;
    setLoading(true);
    loadFavoriteStops(session.user.id)
      .then((items) => {
        if (alive) {
          setFavoriteStops(items);
        }
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [backendReady, session]);

  const removeFavorite = async (stopId: string) => {
    if (!session) {
      return;
    }
    setBusyId(stopId);
    try {
      await setFavoriteStop(session.user.id, stopId, false);
      setFavoriteStops((current) => current.filter((item) => item.stopId !== stopId));
    } finally {
      setBusyId(null);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
          <View style={styles.appBar}>
            <AppBrand compact />
            {session ? (
              <Pressable style={styles.signOutButton} onPress={() => void handleSignOut()}>
                <Ionicons name="log-out-outline" size={19} color={colors.primary} />
                <Text style={styles.signOutText}>Sign out</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.heroCard}>
            <View style={styles.heroIcon}>
              <Ionicons name="star" size={30} color={colors.amber} />
            </View>
            <Text style={styles.title}>Your saved stops</Text>
            <Text style={styles.subtitle}>Keep daily terminals and pickup points one tap away.</Text>
          </View>

          {!session ? (
            <View style={styles.accountCard}>
              <View style={styles.accountIcon}>
                <Ionicons name="cloud-outline" size={28} color={colors.primary} />
              </View>
              <Text style={styles.accountTitle}>Sign in to sync favorites</Text>
              <Text style={styles.accountBody}>Guest mode can browse live buses. A rider account keeps saved stops available across devices.</Text>
              <Pressable style={styles.primaryButton} onPress={() => router.push('/login')}>
                <Text style={styles.primaryButtonText}>Open secure login</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.accountStrip}>
              <View style={styles.liveDot} />
              <Text style={styles.accountStripText}>Synced as {session.user.email}</Text>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Saved stops</Text>
            <Text style={styles.sectionCount}>{favoriteStops.length}</Text>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          ) : favoriteStops.length ? (
            <View style={styles.list}>
              {favoriteStops.map((stop) => (
                <View key={stop.stopId} style={styles.favoriteCard}>
                  <View style={[styles.routeRail, { backgroundColor: stop.color }]} />
                  <View style={styles.favoriteTopRow}>
                    <View style={styles.stopIcon}>
                      <Ionicons name="location" size={22} color={colors.primary} />
                    </View>
                    <View style={styles.favoriteTextWrap}>
                      <Text style={styles.favoriteTitle}>{stop.stopName}</Text>
                      <Text style={styles.favoriteSubtitle}>{stop.routeCode} · {stop.routeName}</Text>
                    </View>
                  </View>
                  <View style={styles.favoriteActions}>
                    <Pressable
                      style={styles.openButton}
                      onPress={() => router.push({ pathname: '/(rider)/route/[routeId]', params: { routeId: stop.routeId } })}
                    >
                      <Text style={styles.openButtonText}>Open route</Text>
                      <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </Pressable>
                    <Pressable style={styles.removeButton} onPress={() => void removeFavorite(stop.stopId)} accessibilityLabel={`Remove ${stop.stopName} from favorites`}>
                      {busyId === stop.stopId ? <ActivityIndicator color={colors.error} /> : <Ionicons name="trash-outline" size={20} color={colors.error} />}
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyCard}>
              <Ionicons name="star-outline" size={38} color={colors.primary} />
              <Text style={styles.emptyTitle}>No saved stops yet</Text>
              <Text style={styles.emptyBody}>Open the Ormoc–Sogod route and tap the star beside a stop.</Text>
              <View style={styles.routeButtons}>
                {localRoutes.map((route) => (
                  <Pressable
                    key={route.id}
                    style={styles.routeButton}
                    onPress={() => router.push({ pathname: '/(rider)/route/[routeId]', params: { routeId: route.id } })}
                  >
                    <Text style={styles.routeButtonText}>{route.code}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          )}
        </ScrollView>
        <RiderBottomNav active="favorites" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  screen: { flex: 1 },
  page: { paddingHorizontal: 18, paddingBottom: 28 },
  appBar: { height: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  signOutButton: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.primarySoft },
  signOutText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 11 },
  heroCard: { marginTop: 12, padding: 22, borderRadius: 26, backgroundColor: colors.surface, shadowColor: '#000000', shadowOpacity: 0.045, shadowRadius: 16, elevation: 2 },
  heroIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.amberSoft, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: 16, color: colors.ink, fontFamily: fonts.bold, fontSize: 27, letterSpacing: -0.5 },
  subtitle: { marginTop: 6, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  accountCard: { marginTop: 18, padding: 20, borderRadius: 22, backgroundColor: colors.surfaceContainer, alignItems: 'center' },
  accountIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  accountTitle: { marginTop: 13, color: colors.ink, fontFamily: fonts.semibold, fontSize: 17 },
  accountBody: { marginTop: 7, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  primaryButton: { marginTop: 15, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 999, backgroundColor: colors.primary },
  primaryButtonText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 12 },
  accountStrip: { marginTop: 18, padding: 13, borderRadius: 16, backgroundColor: '#D8F8DC', flexDirection: 'row', alignItems: 'center', gap: 9 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.secondary },
  accountStripText: { flex: 1, color: colors.secondary, fontFamily: fonts.medium, fontSize: 11 },
  sectionHeader: { marginTop: 24, marginBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 },
  sectionCount: { minWidth: 28, paddingVertical: 5, paddingHorizontal: 9, borderRadius: 999, backgroundColor: colors.primarySoft, color: colors.primary, fontFamily: fonts.semibold, fontSize: 11, textAlign: 'center' },
  loader: { marginTop: 30 },
  list: { gap: 12 },
  favoriteCard: { position: 'relative', padding: 18, borderRadius: 22, backgroundColor: colors.surface, overflow: 'hidden', shadowColor: '#000000', shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  routeRail: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  favoriteTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stopIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: colors.surfaceLow, alignItems: 'center', justifyContent: 'center' },
  favoriteTextWrap: { flex: 1 },
  favoriteTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  favoriteSubtitle: { marginTop: 4, color: colors.outline, fontFamily: fonts.regular, fontSize: 10 },
  favoriteActions: { marginTop: 16, flexDirection: 'row', gap: 10 },
  openButton: { flex: 1, minHeight: 44, paddingHorizontal: 15, borderRadius: 22, backgroundColor: colors.primary, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  openButtonText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 12 },
  removeButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.errorSoft, alignItems: 'center', justifyContent: 'center' },
  emptyCard: { padding: 24, borderRadius: 22, backgroundColor: colors.surface, alignItems: 'center' },
  emptyTitle: { marginTop: 12, color: colors.ink, fontFamily: fonts.semibold, fontSize: 17 },
  emptyBody: { marginTop: 6, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  routeButtons: { marginTop: 14, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  routeButton: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.primarySoft },
  routeButtonText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 11 },
});
