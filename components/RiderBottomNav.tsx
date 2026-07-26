import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '@/lib/theme';

type RiderTab = 'home' | 'map' | 'favorites';

type RiderBottomNavProps = {
  active: RiderTab;
};

const items = [
  { id: 'home', label: 'Home', icon: 'home-outline', route: '/(rider)/home' },
  { id: 'map', label: 'Map', icon: 'map-outline', route: '/(rider)/route/route-ormoc-sogod' },
  { id: 'favorites', label: 'Favorites', icon: 'star-outline', route: '/(rider)/favorites' },
] as const;

export function RiderBottomNav({ active }: RiderBottomNavProps) {
  const router = useRouter();

  return (
    <View style={styles.shell} accessibilityRole="tablist">
      {items.map((item) => {
        const selected = item.id === active;
        return (
          <Pressable
            key={item.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
            onPress={() => router.push(item.route)}
            style={styles.item}
          >
            <View style={[styles.iconWrap, selected && styles.iconWrapSelected]}>
              <Ionicons name={item.icon} size={23} color={selected ? '#FFFFFF' : colors.ink} />
            </View>
            <Text style={[styles.label, selected && styles.labelSelected]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 10,
    paddingTop: 9,
    paddingBottom: 12,
    backgroundColor: 'rgba(248,249,255,0.98)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outlineSoft,
  },
  item: {
    minWidth: 66,
    alignItems: 'center',
    gap: 3,
  },
  iconWrap: {
    minWidth: 50,
    height: 32,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapSelected: {
    backgroundColor: colors.primaryBright,
  },
  label: {
    color: colors.ink,
    fontFamily: fonts.medium,
    fontSize: 11,
  },
  labelSelected: {
    color: colors.primary,
    fontFamily: fonts.semibold,
  },
});
