
import { Stack } from 'expo-router';

export default function DriverLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerTitle: 'Driver Mode' }} />
    </Stack>
  );
}
