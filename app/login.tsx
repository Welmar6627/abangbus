import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/AppBrand';
import {
  isRemoteBackendReady,
  loadCurrentProfile,
} from '@/lib/supabase-transit';
import {
  requestPasswordReset,
  signInWithGoogle,
  signInWithPassword,
  signUpWithPassword,
} from '@/lib/supabase-auth';
import { useSupabaseSession } from '@/lib/use-session';
import { colors, fonts } from '@/lib/theme';
import { isValidEmail, validatePassword } from '@/lib/input-validation';
import * as Linking from 'expo-linking';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const [session] = useSupabaseSession();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const backendReady = isRemoteBackendReady();

  useEffect(() => {
    let active = true;
    if (!session) return;

    void loadCurrentProfile(session.user.id)
      .then((profile) => {
        if (!active) return;
        router.replace(profile?.role === 'driver' || profile?.role === 'admin' ? '/(driver)' : '/(rider)/home');
      })
      .catch(() => {
        if (active) router.replace('/(rider)/home');
      });

    return () => { active = false; };
  }, [router, session]);

  const submit = async () => {
    const passwordError = validatePassword(password);
    if (!isValidEmail(email) || passwordError) {
      setNotice(!isValidEmail(email) ? 'Enter a valid email address.' : passwordError);
      return;
    }
    if (!backendReady) {
      setNotice('Supabase is not connected. Continue as guest for local demo mode.');
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      const { data, error } =
        mode === 'signin'
          ? await signInWithPassword(email, password)
          : await signUpWithPassword(email, password, displayName);

      if (error) {
        setNotice(error.message);
        return;
      }

      if (mode === 'signup' && !data.session) {
        setNotice('Account created. Check your email to confirm it, then sign in.');
        setMode('signin');
        return;
      }

      const profile = data.user ? await loadCurrentProfile(data.user.id) : null;
      router.replace(profile?.role === 'driver' || profile?.role === 'admin' ? '/(driver)' : '/(rider)/home');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sign in right now.');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!isValidEmail(email)) {
      setNotice('Enter your email address first, then request a password reset.');
      return;
    }
    if (!backendReady) {
      setNotice('Supabase is not connected. Password reset is unavailable.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
        ? `${window.location.origin}/reset-password`
        : Linking.createURL('/reset-password');
      const { error } = await requestPasswordReset(email, redirectTo);
      if (error) throw error;
      setNotice('If an account exists for that email, a password-reset link has been sent.');
    } catch {
      setNotice('Unable to request a password reset right now. Please try again later.');
    } finally {
      setBusy(false);
    }
  };

  const continueWithGoogle = async () => {
    if (!backendReady) {
      setNotice('Supabase is not connected. Google sign-in is unavailable.');
      return;
    }

    setBusy(true);
    setNotice(null);
    try {
      await signInWithGoogle();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Unable to sign in with Google.');
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.blueGlow} />
          <View style={styles.greenGlow} />

          <View style={styles.brandArea}>
            <View style={styles.logoTile}>
              <Ionicons name="bus" size={42} color="#FFFFFF" />
            </View>
            <AppBrand />
            <Text style={styles.tagline}>Reliable provincial transit at your fingertips</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.formTitle}>{mode === 'signin' ? 'Welcome back' : 'Create your rider account'}</Text>
            <Text style={styles.formSubtitle}>
              {mode === 'signin' ? 'Sign in to sync favorite stops across devices.' : 'Save stops and follow your daily route.'}
            </Text>

            {mode === 'signup' ? (
              <Field icon="person-outline" value={displayName} onChangeText={setDisplayName} placeholder="Display name" />
            ) : null}
            <Field
              icon="mail-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="Email address"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Field
              icon="lock-closed-outline"
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              secureTextEntry
              maxLength={128}
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            />

            <View style={styles.utilityRow}>
              <View style={styles.rememberRow}>
                <View style={[styles.checkbox, styles.checkboxChecked]}>
                  <Ionicons name="checkmark" size={15} color="#FFFFFF" />
                </View>
                <Text style={styles.utilityText}>Secure persistent session</Text>
              </View>
              <Pressable onPress={() => void resetPassword()} disabled={busy} accessibilityRole="button">
                <Text style={styles.linkText}>Forgot password?</Text>
              </Pressable>
            </View>

            <Pressable style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]} onPress={() => void submit()} disabled={busy}>
              {busy ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.primaryButtonText}>{mode === 'signin' ? 'Sign in' : 'Create account'}  →</Text>}
            </Pressable>

            {notice ? <Text style={styles.notice}>{notice}</Text> : null}

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>OR</Text>
              <View style={styles.divider} />
            </View>

            <Pressable style={styles.googleButton} onPress={() => void continueWithGoogle()} disabled={busy}>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </Pressable>

            <Pressable style={styles.guestButton} onPress={() => router.replace('/(rider)/home')}>
              <Ionicons name="navigate-circle-outline" size={22} color={colors.primary} />
              <Text style={styles.guestButtonText}>Continue as guest</Text>
            </Pressable>

            <Pressable style={styles.switchRow} onPress={() => { setMode((current) => current === 'signin' ? 'signup' : 'signin'); setNotice(null); }}>
              <Text style={styles.switchText}>{mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}</Text>
              <Text style={styles.switchLink}>{mode === 'signin' ? 'Create account' : 'Sign in'}</Text>
            </Pressable>
          </View>

          <View style={styles.trustRow}>
            <View style={[styles.trustPill, styles.livePill]}>
              <View style={styles.liveDot} />
              <Text style={styles.livePillText}>Live status ready</Text>
            </View>
            <View style={[styles.trustPill, styles.securePill]}>
              <Ionicons name="shield-checkmark-outline" size={16} color={colors.amber} />
              <Text style={styles.securePillText}>Secure login</Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Read the AbangBus privacy notice"
            onPress={() => router.push('/privacy')}
            style={styles.privacyLink}
          >
            <Text style={styles.privacyLinkText}>Privacy notice</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type FieldProps = React.ComponentProps<typeof TextInput> & { icon: React.ComponentProps<typeof Ionicons>['name'] };

function Field({ icon, ...props }: FieldProps) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={21} color={colors.outline} />
      <TextInput placeholderTextColor={colors.outlineSoft} style={styles.input} {...props} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.background },
  page: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 28, paddingBottom: 32, justifyContent: 'center', overflow: 'hidden' },
  blueGlow: { position: 'absolute', width: 300, height: 300, borderRadius: 150, top: -160, left: -120, backgroundColor: colors.primarySoft, opacity: 0.6 },
  greenGlow: { position: 'absolute', width: 280, height: 280, borderRadius: 140, bottom: -150, right: -130, backgroundColor: colors.secondarySoft, opacity: 0.18 },
  brandArea: { alignItems: 'center', marginBottom: 24 },
  logoTile: { width: 84, height: 84, borderRadius: 22, backgroundColor: colors.primaryBright, alignItems: 'center', justifyContent: 'center', marginBottom: 14, shadowColor: colors.primary, shadowOpacity: 0.18, shadowRadius: 16, elevation: 5 },
  tagline: { marginTop: 6, color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 14, textAlign: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: 28, padding: 20, gap: 13, shadowColor: '#000000', shadowOpacity: 0.06, shadowRadius: 22, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  formTitle: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 22, letterSpacing: -0.3 },
  formSubtitle: { color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, marginBottom: 3 },
  inputWrap: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 11, paddingHorizontal: 15, backgroundColor: colors.surfaceLow, borderColor: colors.outlineSoft, borderWidth: 1, borderRadius: 15 },
  input: { flex: 1, color: colors.ink, fontFamily: fonts.regular, fontSize: 15, paddingVertical: 14 },
  utilityRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  rememberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 21, height: 21, borderRadius: 5, borderWidth: 1.5, borderColor: colors.outlineSoft, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  utilityText: { color: colors.inkMuted, fontFamily: fonts.medium, fontSize: 12 },
  linkText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 12 },
  primaryButton: { minHeight: 58, borderRadius: 999, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 3, shadowColor: colors.primary, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 7 }, elevation: 4 },
  buttonPressed: { opacity: 0.86, transform: [{ scale: 0.99 }] },
  primaryButtonText: { color: '#FFFFFF', fontFamily: fonts.semibold, fontSize: 16 },
  notice: { color: colors.error, backgroundColor: colors.errorSoft, borderRadius: 10, padding: 10, fontFamily: fonts.medium, fontSize: 12, lineHeight: 17 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 3 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.outlineSoft },
  dividerText: { color: colors.outline, fontFamily: fonts.medium, fontSize: 11 },
  guestButton: { minHeight: 54, borderRadius: 999, borderWidth: 1.5, borderColor: colors.outlineSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  guestButtonText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  googleButton: { minHeight: 54, borderRadius: 999, borderWidth: 1.5, borderColor: colors.outlineSoft, backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  googleButtonText: { color: colors.ink, fontFamily: fonts.semibold, fontSize: 15 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', paddingTop: 4 },
  switchText: { color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 13 },
  switchLink: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 13 },
  trustRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginTop: 18 },
  trustPill: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999 },
  livePill: { backgroundColor: '#D8F8DC' },
  securePill: { backgroundColor: '#F7EFD9' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.secondary },
  livePillText: { color: colors.secondary, fontFamily: fonts.medium, fontSize: 12 },
  securePillText: { color: '#5B4300', fontFamily: fonts.medium, fontSize: 12 },
  privacyLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  privacyLinkText: { color: colors.primary, fontFamily: fonts.semibold, fontSize: 12, textDecorationLine: 'underline' },
});
