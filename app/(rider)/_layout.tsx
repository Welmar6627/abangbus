
import { Stack } from 'expo-router';

export default function RiderLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="home" />
      <Stack.Screen name="favorites" />
      <Stack.Screen name="route/[routeId]" />
    </Stack>
  );
}
