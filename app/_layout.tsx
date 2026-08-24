
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import { colors } from '@/lib/theme';
import { SupabaseSessionProvider } from '@/lib/use-session';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';

void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  useEffect(() => {
    if (loaded) {
      void SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <SupabaseSessionProvider>
          <Stack screenOptions={{ contentStyle: { backgroundColor: colors.background }, headerShown: false, title: 'AbangBus — Live Provincial Transit' }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="reset-password" />
            <Stack.Screen name="privacy" />
            <Stack.Screen name="(driver)" options={{ headerShown: false }} />
            <Stack.Screen name="(rider)" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="dark" />
        </SupabaseSessionProvider>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}
