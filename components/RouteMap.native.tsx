import { useEffect, useRef } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import MapView, { AnimatedRegion, Marker, UrlTile } from 'react-native-maps';
import { type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';
import { getTripFreshness } from '@/lib/trip-freshness';

type RouteMapProps = {
  route: RouteDefinition;
  trips: TripSnapshot[];
  height?: number;
  selectedTripId?: string | null;
  onSelectTrip?: (tripId: string) => void;
};

export default function RouteMap({ route, trips, height = 330, selectedTripId, onSelectTrip }: RouteMapProps) {
  const latitudeValues = route.path.map((point) => point.latitude);
  const longitudeValues = route.path.map((point) => point.longitude);
  const minLatitude = Math.min(...latitudeValues);
  const maxLatitude = Math.max(...latitudeValues);
  const minLongitude = Math.min(...longitudeValues);
  const maxLongitude = Math.max(...longitudeValues);
  const latitudeSpan = Math.max(0.22, (maxLatitude - minLatitude) * 1.5);
  const longitudeSpan = Math.max(0.28, (maxLongitude - minLongitude) * 1.35);

  return (
    <View style={[styles.container, { height }]}>
      <MapView
        style={styles.map}
        mapType="none"
        initialRegion={{
          latitude: (minLatitude + maxLatitude) / 2,
          longitude: (minLongitude + maxLongitude) / 2,
          latitudeDelta: latitudeSpan,
          longitudeDelta: longitudeSpan,
        }}
      >
        <UrlTile urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} flipY={false} />
        {route.stops.map((stop) => (
          <Marker
            key={stop.id}
            coordinate={stop.location}
            pinColor={route.color}
            title={stop.name}
            description={route.code}
          />
        ))}
        {trips.map((trip) => (
          <NativeBusMarker key={trip.id} trip={trip} routeCode={route.code} selected={selectedTripId === trip.id} onPress={onSelectTrip} />
        ))}
      </MapView>
      <View style={[styles.routePill, { backgroundColor: route.color }]}> 
        <Text style={styles.routePillText}>{route.code}</Text>
      </View>
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

function NativeBusMarker({ trip, routeCode, selected, onPress }: { trip: TripSnapshot; routeCode: string; selected: boolean; onPress?: (tripId: string) => void }) {
  const coordinate = useRef(new AnimatedRegion({ ...trip.position, latitudeDelta: 0, longitudeDelta: 0 })).current;
  const freshness = getTripFreshness(trip.lastUpdatedAt);

  useEffect(() => {
    const region = { ...trip.position, latitudeDelta: 0, longitudeDelta: 0 };
    coordinate.timing({ ...region, toValue: region, duration: 7000, useNativeDriver: false } as never).start();
  }, [coordinate, trip.position]);

  return (
    <Marker.Animated
      coordinate={coordinate as unknown as TripSnapshot['position']}
      anchor={{ x: 0.5, y: 0.5 }}
      rotation={trip.bearing || 0}
      flat
      title={`${trip.busCode} on ${routeCode}`}
      description={`${trip.driverName} · ${Math.round(trip.speedKph)} km/h · ${freshness}`}
      zIndex={selected ? 3 : 2}
      onPress={() => onPress?.(trip.id)}
    >
      <View style={[styles.busMarker, selected && styles.busMarkerSelected, freshness === 'stale' && styles.busMarkerStale]}>
        <Image source={require('@/assets/images/live-bus-3d.png')} style={styles.busImage} resizeMode="contain" fadeDuration={0} />
        <View style={[styles.freshnessDot, freshness === 'delayed' && styles.freshnessDelayed, freshness === 'stale' && styles.freshnessStale]} />
      </View>
    </Marker.Animated>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 28,
    overflow: 'hidden',
    backgroundColor: '#E8F5EF',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  busMarker: { width: 52, height: 72, alignItems: 'center', justifyContent: 'center' },
  busMarkerSelected: { width: 62, height: 84 },
  busMarkerStale: { opacity: 0.62 },
  busImage: { width: '100%', height: '100%' },
  freshnessDot: { position: 'absolute', right: 0, top: 2, width: 10, height: 10, borderRadius: 5, backgroundColor: '#006E1C', borderWidth: 2, borderColor: '#FFFFFF' },
  freshnessDelayed: { backgroundColor: '#946F00' },
  freshnessStale: { backgroundColor: '#64748B' },
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
  attribution: {
    position: 'absolute',
    right: 6,
    bottom: 5,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.88)',
  },
  attributionText: {
    color: '#334155',
    fontSize: 9,
  },
});
