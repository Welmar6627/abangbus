
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <Stack screenOptions={{ contentStyle: { backgroundColor: '#07111D' } }}>
        <Stack.Screen name="(driver)" options={{ headerShown: false }} />
        <Stack.Screen name="(rider)" options={{ headerShown: false }} />
      </Stack>
      <StatusBar style="light" />
    </>
  );
}
