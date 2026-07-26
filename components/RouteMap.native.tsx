import { StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, UrlTile } from 'react-native-maps';
import { type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';

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
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
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
