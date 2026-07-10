import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { clamp, type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';

type RouteMapProps = {
  route: RouteDefinition;
  trips: TripSnapshot[];
  selectedTripId?: string | null;
  onSelectTrip?: (tripId: string) => void;
};

function getBounds(route: RouteDefinition) {
  const latitudes = route.path.map((point) => point.latitude);
  const longitudes = route.path.map((point) => point.longitude);
  return {
    minLat: Math.min(...latitudes),
    maxLat: Math.max(...latitudes),
    minLng: Math.min(...longitudes),
    maxLng: Math.max(...longitudes),
  };
}

function WebRoutePreview({ route, trips, selectedTripId, onSelectTrip }: RouteMapProps) {
  const bounds = getBounds(route);

  return (
    <View style={styles.webPreview}>
      <View style={styles.webHeader}>
        <Text style={styles.webTitle}>{route.code} live corridor</Text>
        <Text style={styles.webSubtitle}>{route.name}</Text>
      </View>
      <View style={styles.webRail}>
        {route.path.map((point, index) => {
          const x = `${clamp(((point.longitude - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng, 0.00001)) * 100, 0, 100)}%` as `${number}%`;
          const y = `${clamp(100 - ((point.latitude - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat, 0.00001)) * 100, 0, 100)}%` as `${number}%`;
          return <View key={`${route.id}-point-${index}`} style={[styles.webNode, { left: x, top: y }]} />;
        })}
        {trips.map((trip) => {
          const left = `${clamp(((trip.position.longitude - bounds.minLng) / Math.max(bounds.maxLng - bounds.minLng, 0.00001)) * 100, 0, 100)}%` as `${number}%`;
          const top = `${clamp(100 - ((trip.position.latitude - bounds.minLat) / Math.max(bounds.maxLat - bounds.minLat, 0.00001)) * 100, 0, 100)}%` as `${number}%`;
          const selected = selectedTripId === trip.id;
          return (
            <Pressable
              key={trip.id}
              onPress={() => onSelectTrip?.(trip.id)}
              style={[
                styles.webBus,
                { left, top, borderColor: route.color },
                selected && styles.webBusSelected,
              ]}
            >
              <Text style={styles.webBusLabel}>{trip.busCode}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function RouteMap(props: RouteMapProps) {
  const { route, trips, selectedTripId, onSelectTrip } = props;

  if (Platform.OS === 'web') {
    return <WebRoutePreview {...props} trips={trips} />;
  }

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: route.center.latitude,
          longitude: route.center.longitude,
          latitudeDelta: 0.045,
          longitudeDelta: 0.045,
        }}
      >
        <Polyline coordinates={route.path} strokeColor={route.color} strokeWidth={5} />
        {route.stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={stop.location}
            pinColor={route.color}
            title={stop.name}
            description={route.code}
          />
        ))}
        {trips.map((trip) => {
          const selected = selectedTripId === trip.id;
          return (
            <Marker
              key={trip.id}
              coordinate={trip.position}
              title={`${trip.busCode} on ${route.code}`}
              description={`${trip.driverName} - ${trip.speedKph.toFixed(0)} km/h`}
              pinColor={route.color}
              zIndex={selected ? 2 : 1}
              onPress={() => onSelectTrip?.(trip.id)}
            />
          );
        })}
      </MapView>
      <View style={[styles.routePill, { backgroundColor: route.color }]}>
        <Text style={styles.routePillText}>{route.code}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    height: 330,
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E8F5EF',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  routePill: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  routePillText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  webPreview: {
    minHeight: 330,
    borderRadius: 28,
    backgroundColor: '#F5FAF7',
    borderWidth: 1,
    borderColor: '#D6E7DD',
    overflow: 'hidden',
    padding: 16,
  },
  webHeader: {
    marginBottom: 10,
  },
  webTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  webSubtitle: {
    marginTop: 4,
    fontSize: 13,
    color: '#475569',
  },
  webRail: {
    height: 260,
    position: 'relative',
    borderRadius: 24,
    backgroundColor: '#E3F0E8',
    overflow: 'hidden',
  },
  webNode: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    transform: [{ translateX: -6 }, { translateY: -6 }],
  },
  webBus: {
    position: 'absolute',
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 2,
    backgroundColor: '#fff',
    transform: [{ translateX: -27 }, { translateY: -20 }],
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 2,
  },
  webBusSelected: {
    transform: [{ translateX: -27 }, { translateY: -20 }, { scale: 1.05 }],
  },
  webBusLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0F172A',
  },
});
