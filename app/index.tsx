import { useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/AppBrand';
import { useSupabaseSession } from '@/lib/use-session';
import { colors, fonts } from '@/lib/theme';

export default function SplashScreen() {
  const router = useRouter();
  const [session] = useSupabaseSession();
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(motion, { toValue: 1, duration: 1200, useNativeDriver: true }),
        Animated.timing(motion, { toValue: 0, duration: 1200, useNativeDriver: true }),
      ]),
    );
    animation.start();

    const timer = setTimeout(() => {
      router.replace(session ? '/(rider)/home' : '/login');
    }, 1700);

    return () => {
      clearTimeout(timer);
      animation.stop();
    };
  }, [motion, router, session]);

  const openApp = () => router.replace(session ? '/(rider)/home' : '/login');

  return (
    <SafeAreaView style={styles.safeArea}>
      <Pressable style={styles.page} onPress={openApp} accessibilityRole="button" accessibilityLabel="Open AbangBus">
        <View style={styles.topGlow} />
        <AppBrand />

        <View style={styles.hero}>
          <Animated.View
            style={[
              styles.illustration,
              {
                transform: [
                  {
                    translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [0, -9] }),
                  },
                ],
              },
            ]}
          >
            <View style={styles.routeArc} />
            <View style={styles.busCircle}>
              <Ionicons name="bus" size={86} color="#FFFFFF" />
            </View>
            <View style={[styles.stopDot, styles.stopDotLeft]} />
            <View style={[styles.stopDot, styles.stopDotRight]} />
          </Animated.View>
          <Text style={styles.title}>Know when your bus is coming.</Text>
          <Text style={styles.subtitle}>Real-time tracking for a smoother, smarter daily commute.</Text>
          <View style={styles.pilotPill}>
            <Ionicons name="navigate" size={15} color={colors.primary} />
            <Text style={styles.pilotText}>Ormoc to Sogod pilot corridor</Text>
          </View>
        </View>

        <View style={styles.loadingArea}>
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.progress,
                {
                  opacity: motion.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
                  transform: [{ scaleX: motion.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }) }],
                },
              ]}
            />
          </View>
          <View style={styles.statusRow}>
            <View style={styles.liveDot} />
            <Text style={styles.statusText}>Connecting to live fleet...</Text>
          </View>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 34,
    overflow: 'hidden',
  },
  topGlow: {
    position: 'absolute',
    width: 420,
    height: 420,
    borderRadius: 210,
    top: -250,
    left: -180,
    backgroundColor: colors.primarySoft,
    opacity: 0.72,
  },
  hero: { alignItems: 'center', width: '100%' },
  illustration: {
    width: 250,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 22,
  },
  routeArc: {
    position: 'absolute',
    width: 230,
    height: 124,
    borderRadius: 120,
    borderWidth: 3,
    borderColor: colors.primarySoft,
    transform: [{ rotate: '-12deg' }],
  },
  busCircle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: colors.primaryBright,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOpacity: 0.24,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
  stopDot: {
    position: 'absolute',
    width: 17,
    height: 17,
    borderRadius: 9,
    backgroundColor: colors.secondary,
    borderWidth: 4,
    borderColor: colors.secondarySoft,
  },
  stopDotLeft: { left: 5, top: 128 },
  stopDotRight: { right: 8, top: 62 },
  title: {
    maxWidth: 330,
    color: colors.ink,
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.7,
    textAlign: 'center',
  },
  subtitle: {
    maxWidth: 320,
    marginTop: 12,
    color: colors.inkMuted,
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 23,
    textAlign: 'center',
  },
  pilotPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceLow,
  },
  pilotText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 12 },
  loadingArea: { width: '100%', maxWidth: 340, alignItems: 'center', gap: 20 },
  track: { width: '100%', height: 5, borderRadius: 3, backgroundColor: colors.primarySoft, overflow: 'hidden' },
  progress: { width: '100%', height: '100%', borderRadius: 3, backgroundColor: colors.primary, transformOrigin: 'left' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.secondary },
  statusText: {
    color: colors.inkMuted,
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
});
