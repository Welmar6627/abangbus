import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type AppBrandProps = {
  compact?: boolean;
  light?: boolean;
};

export function AppBrand({ compact = false, light = false }: AppBrandProps) {
  const color = light ? '#FFFFFF' : colors.primary;

  return (
    <View style={styles.row} accessibilityLabel="AbangBus">
      <Ionicons name="bus" size={compact ? 24 : 34} color={color} />
      <Text style={[styles.name, compact && styles.compactName, { color }]}>AbangBus</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 32,
    letterSpacing: -1,
  },
  compactName: {
    fontSize: 27,
  },
});
