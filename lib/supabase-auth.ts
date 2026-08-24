import { Platform } from 'react-native';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { normalizeEmail } from '@/lib/input-validation';
import { supabase } from '@/lib/supabase';

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.');
  return supabase;
}

export async function signInWithPassword(email: string, password: string) {
  return requireSupabase().auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });
}

export async function signInWithGoogle() {
  const client = requireSupabase();
  const redirectTo = Platform.OS === 'web' && typeof window !== 'undefined'
    ? `${window.location.origin}/login`
    : Linking.createURL('/login');
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) throw error;
  if (Platform.OS === 'web') return;
  if (!data.url) throw new Error('Google did not return a sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Google sign-in was cancelled.');

  const code = getOAuthValue(result.url, 'code');
  if (code) {
    const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  const accessToken = getOAuthValue(result.url, 'access_token');
  const refreshToken = getOAuthValue(result.url, 'refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('Google sign-in returned without a Supabase session. Check the redirect URL configuration.');
  }

  const { error: sessionError } = await client.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (sessionError) throw sessionError;
}

function getOAuthValue(url: string, key: string) {
  const match = url.match(new RegExp(`[?#&]${key}=([^&]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function signUpWithPassword(email: string, password: string, displayName: string) {
  return requireSupabase().auth.signUp({
    email: normalizeEmail(email),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
}

export async function requestPasswordReset(email: string, redirectTo: string) {
  return requireSupabase().auth.resetPasswordForEmail(normalizeEmail(email), { redirectTo });
}

export async function updatePassword(password: string) {
  return requireSupabase().auth.updateUser({ password });
}

export async function signOut() {
  if (supabase) await supabase.auth.signOut();
}
