import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getTrips, subscribeToTrips } from '@/lib/demo-tracker';
import { defaultRouteId, getRouteById, routes } from '@/lib/abangbus-data';

export default function IndexScreen() {
  const router = useRouter();
  const [trips, setTrips] = useState(getTrips());

  const featuredRoute = useMemo(() => getRouteById(defaultRouteId), []);

  useEffect(() => subscribeToTrips(setTrips), []);

  return (
    <ScrollView contentContainerStyle={styles.page} showsVerticalScrollIndicator={false}>
      <View style={styles.backdropGlow} />
      <View style={styles.heroCard}>
        <View style={styles.heroBadge}>
          <Text style={styles.heroBadgeText}>AbangBus MVP</Text>
        </View>
        <Text style={styles.title}>Live buses, without the guesswork.</Text>
        <Text style={styles.subtitle}>
          Driver-shared location on a public rider map. Built for pilot routes first, with a clean path to Supabase later.
        </Text>

        <View style={styles.heroStatsRow}>
          <Stat label="Pilot routes" value={`${routes.length}`} />
          <Stat label="Active buses" value={`${trips.length}`} />
          <Stat label="Default route" value={featuredRoute.code} />
        </View>

        <View style={styles.actionRow}>
          <Pressable style={[styles.primaryButton, styles.driverButton]} onPress={() => router.push('/(driver)')}>
            <Text style={styles.primaryButtonText}>Open driver mode</Text>
          </Pressable>
          <Pressable style={[styles.primaryButton, styles.riderButton]} onPress={() => router.push('/(rider)')}>
            <Text style={styles.primaryButtonText}>Open rider map</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>What ships in this build</Text>
        <Text style={styles.sectionSubtitle}>A practical starting point for the capstone.</Text>
      </View>

      <View style={styles.featureGrid}>
        <FeatureCard
          title="Driver mode"
          body="Pick a route, start a trip, and share location while the trip is active."
          tone="green"
        />
        <FeatureCard
          title="Rider map"
          body="See live buses by route with no rider account and no location permission required."
          tone="blue"
        />
        <FeatureCard
          title="Demo-safe"
          body="Runs with local demo data first, so the app still works while backend keys are being set up."
          tone="amber"
        />
        <FeatureCard
          title="Supabase-ready"
          body="The schema and client wiring are scaffolded for the real backend flow in the next step."
          tone="slate"
        />
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function FeatureCard({ title, body, tone }: { title: string; body: string; tone: 'green' | 'blue' | 'amber' | 'slate' }) {
  const toneStyles = {
    green: styles.greenCard,
    blue: styles.blueCard,
    amber: styles.amberCard,
    slate: styles.slateCard,
  }[tone];

  return (
    <View style={[styles.featureCard, toneStyles]}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    padding: 20,
    paddingTop: 56,
    paddingBottom: 36,
    backgroundColor: '#08111E',
    minHeight: '100%',
    position: 'relative',
  },
  backdropGlow: {
    position: 'absolute',
    top: -80,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(37, 99, 235, 0.28)',
  },
  heroCard: {
    borderRadius: 32,
    padding: 22,
    backgroundColor: '#F8FAFC',
    shadowColor: '#000',
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 4,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#E8F5EF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 18,
  },
  heroBadgeText: {
    color: '#14704F',
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 0.4,
  },
  title: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    color: '#0F172A',
    letterSpacing: -0.6,
  },
  subtitle: {
    marginTop: 14,
    fontSize: 16,
    lineHeight: 23,
    color: '#475569',
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  statCard: {
    flexGrow: 1,
    minWidth: 90,
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    backgroundColor: '#EEF4FB',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#0F172A',
  },
  statLabel: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexGrow: 1,
    minWidth: 140,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
  },
  driverButton: {
    backgroundColor: '#1D9E75',
  },
  riderButton: {
    backgroundColor: '#2563EB',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
    fontSize: 15,
  },
  sectionHeader: {
    marginTop: 22,
    marginBottom: 14,
  },
  sectionTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '800',
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#94A3B8',
    fontSize: 13,
  },
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  featureCard: {
    width: '48%',
    minWidth: 150,
    borderRadius: 22,
    padding: 16,
    backgroundColor: '#132033',
    borderWidth: 1,
  },
  greenCard: {
    borderColor: 'rgba(29, 158, 117, 0.35)',
  },
  blueCard: {
    borderColor: 'rgba(37, 99, 235, 0.35)',
  },
  amberCard: {
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  slateCard: {
    borderColor: 'rgba(148, 163, 184, 0.35)',
  },
  featureTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  featureBody: {
    marginTop: 8,
    color: '#CBD5E1',
    lineHeight: 20,
    fontSize: 13,
  },
});
