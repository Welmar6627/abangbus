import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts } from '@/lib/theme';

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>AbangBus Privacy Notice</Text>
        <Text style={styles.updated}>Last updated: August 24, 2026</Text>
        <Section title="Information we use">
          AbangBus uses account details to authenticate riders and approved drivers. Riders may save favorite stops. During an active driver trip, the app processes precise location, speed, heading, GPS accuracy, mock-location status, and timestamps so riders can see the current bus position.
        </Section>
        <Section title="Retention">
          Current positions are removed when a trip ends. Detailed driver position history is retained for up to 30 days. Security audit records are retained for up to 365 days. Account and favorite-stop data remain until deleted, subject to legal and security requirements.
        </Section>
        <Section title="Sharing and advertising">
          Location history is not sold and is not used for advertising. Public riders receive only the current position required for active-trip tracking. Supabase hosts application data, and optional authentication providers process sign-in information under their own terms.
        </Section>
        <Section title="Your choices">
          You may decline location access, but approved drivers cannot broadcast a live trip without foreground GPS permission. Users may request access, correction, or deletion of account data through the operator contact published with the production release.
        </Section>
        <View style={styles.launchNotice} accessibilityRole="alert">
          <Text style={styles.launchNoticeText}>Operator legal name, address, and privacy contact must be published here before public launch.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.body}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 24, paddingBottom: 48 },
  backButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 14 },
  title: { marginTop: 18, color: colors.ink, fontFamily: fonts.bold, fontSize: 30, lineHeight: 37 },
  updated: { marginTop: 7, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 12 },
  section: { marginTop: 25 },
  sectionTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 18 },
  body: { marginTop: 7, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  launchNotice: { marginTop: 28, padding: 16, borderRadius: 14, backgroundColor: colors.errorSoft },
  launchNoticeText: { color: colors.error, fontFamily: fonts.semibold, fontSize: 13, lineHeight: 19 },
});
