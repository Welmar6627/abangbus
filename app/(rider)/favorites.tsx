import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { routes as localRoutes } from '@/lib/abangbus-data';
import {
  isRemoteBackendReady,
  loadFavoriteStops,
  setFavoriteStop,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/supabase-transit';
import { useSupabaseSession } from '@/lib/use-session';

type FavoriteStopItem = {
  stopId: string;
  stopName: string;
  routeId: string;
  routeCode: string;
  routeName: string;
  color: string;
};

export default function FavoritesScreen() {
  const router = useRouter();
  const [session] = useSupabaseSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStopItem[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const backendReady = isRemoteBackendReady();

  useEffect(() => {
    if (!backendReady || !session) {
      setFavoriteStops([]);
      return;
    }

    let alive = true;
    loadFavoriteStops(session.user.id).then((items) => {
      if (alive) {
        setFavoriteStops(items);
      }
    });

    return () => {
      alive = false;
    };
  }, [backendReady, session]);

  const handleRemoveFavorite = async (stopId: string) => {
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

  const handleSignIn = async () => {
    setNotice(null);
    const { error } = await signInWithPassword(email, password);
    if (error) {
      setNotice(error.message);
    }
  };

  const handleSignUp = async () => {
    setNotice(null);
    const { error } = await signUpWithPassword(email, password, displayName);
    if (error) {
      setNotice(error.message);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.topCard}>
        <Text style={styles.kicker}>Favorites</Text>
        <Text style={styles.title}>Saved stops for your daily ride.</Text>
        <Text style={styles.subtitle}>
          Save the terminals and stops you use most, then jump straight back to their route details later.
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.authCard}>
          {session ? (
            <>
              <Text style={styles.authLabel}>Signed in as</Text>
              <Text style={styles.authValue}>{session.user.email}</Text>
              <Text style={styles.authHint}>
                Favorites are stored in Supabase and synced across devices when this project is configured.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.authLabel}>Sign in to save favorites</Text>
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
                <Pressable style={[styles.button, styles.primaryButton]} onPress={handleSignIn}>
                  <Text style={styles.buttonText}>Sign in</Text>
                </Pressable>
                <Pressable style={[styles.button, styles.secondaryButton]} onPress={handleSignUp}>
                  <Text style={styles.buttonText}>Create account</Text>
                </Pressable>
              </View>
            </>
          )}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {!backendReady ? <Text style={styles.authHint}>Connect a Supabase project to enable synced favorites.</Text> : null}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved stops</Text>
        {favoriteStops.length ? (
          <View style={styles.list}>
            {favoriteStops.map((stop) => (
              <View key={stop.stopId} style={styles.favoriteCard}>
                <View style={styles.favoriteTopRow}>
                  <View>
                    <Text style={styles.favoriteTitle}>{stop.stopName}</Text>
                    <Text style={styles.favoriteSubtitle}>
                      {stop.routeCode} - {stop.routeName}
                    </Text>
                  </View>
                  <View style={[styles.routeBadge, { backgroundColor: stop.color }]}>
                    <Text style={styles.routeBadgeText}>{stop.routeCode}</Text>
                  </View>
                </View>
                <View style={styles.favoriteActions}>
                  <Pressable
                    style={[styles.actionButton, styles.routeButton]}
                    onPress={() => router.push({ pathname: '/(rider)/route/[routeId]', params: { routeId: stop.routeId } })}
                  >
                    <Text style={styles.actionText}>Open route</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButton, styles.removeButton]}
                    onPress={() => void handleRemoveFavorite(stop.stopId)}
                  >
                    {busyId === stop.stopId ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.actionText}>Remove</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No saved stops yet.</Text>
            <Text style={styles.emptyBody}>
              Open a route detail page and tap Save on the stops you want to keep close.
            </Text>
            <View style={styles.sampleRoutes}>
              {localRoutes.map((route) => (
                <Pressable
                  key={route.id}
                  style={[styles.sampleRouteButton, { borderColor: route.color }]}
                  onPress={() => router.push({ pathname: '/(rider)/route/[routeId]', params: { routeId: route.id } })}
                >
                  <Text style={styles.sampleRouteText}>{route.code}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
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
  input: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    paddingVertical: 4,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#0F172A',
  },
  notice: {
    color: '#FCA5A5',
    fontSize: 12,
    lineHeight: 18,
  },
  button: {
    flexGrow: 1,
    minWidth: 120,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#1D9E75',
  },
  secondaryButton: {
    backgroundColor: '#2563EB',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  list: {
    gap: 10,
  },
  favoriteCard: {
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#132033',
    borderWidth: 1,
    borderColor: '#22324A',
    gap: 14,
  },
  favoriteTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  favoriteTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '800',
  },
  favoriteSubtitle: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 12,
  },
  routeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  routeBadgeText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 12,
  },
  favoriteActions: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  actionButton: {
    minWidth: 120,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
  },
  routeButton: {
    backgroundColor: '#1D9E75',
  },
  removeButton: {
    backgroundColor: '#DC2626',
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
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
  sampleRoutes: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
    marginTop: 14,
  },
  sampleRouteButton: {
    minWidth: 64,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#0F172A',
    alignItems: 'center',
  },
  sampleRouteText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
