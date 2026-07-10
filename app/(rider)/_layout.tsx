
import { Stack } from 'expo-router';

export default function RiderLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerTitle: 'Rider Mode' }} />
      <Stack.Screen name="favorites" options={{ headerTitle: 'Favorites' }} />
      <Stack.Screen name="route/[routeId]" options={{ headerTitle: 'Route Detail' }} />
    </Stack>
  );
}
