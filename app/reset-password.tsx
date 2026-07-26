import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppBrand } from '@/components/AppBrand';
import { updatePassword } from '@/lib/supabase-transit';
import { validatePassword } from '@/lib/input-validation';
import { colors, fonts } from '@/lib/theme';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const submit = async () => {
    const validationError = validatePassword(password);
    if (validationError || password !== confirmation) {
      setNotice(validationError ?? 'Passwords do not match.');
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;
      setNotice('Password updated. You can now sign in.');
      setTimeout(() => router.replace('/login'), 900);
    } catch {
      setNotice('This reset link is invalid or expired. Request a new link from sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.card}>
        <AppBrand />
        <Text style={styles.title}>Choose a new password</Text>
        <Text style={styles.body}>Use at least 8 characters. A longer, unique passphrase is best.</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry maxLength={128} autoComplete="new-password" placeholder="New password" placeholderTextColor={colors.outline} />
        <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} secureTextEntry maxLength={128} autoComplete="new-password" placeholder="Confirm new password" placeholderTextColor={colors.outline} />
        {notice ? <Text accessibilityLiveRegion="polite" style={styles.notice}>{notice}</Text> : null}
        <Pressable disabled={busy} onPress={() => void submit()} style={styles.button}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update password</Text>}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: colors.background },
  card: { width: '100%', maxWidth: 460, alignSelf: 'center', gap: 14, padding: 24, borderRadius: 24, backgroundColor: colors.surface },
  title: { marginTop: 10, color: colors.ink, fontFamily: fonts.semibold, fontSize: 24 },
  body: { color: colors.inkMuted, fontFamily: fonts.regular, fontSize: 14, lineHeight: 21 },
  input: { minHeight: 56, paddingHorizontal: 15, borderWidth: 1, borderColor: colors.outlineSoft, borderRadius: 14, color: colors.ink, fontFamily: fonts.regular },
  notice: { padding: 11, borderRadius: 10, color: colors.ink, backgroundColor: colors.surfaceLow, fontFamily: fonts.medium },
  button: { minHeight: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: colors.primary },
  buttonText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 15 },
});
