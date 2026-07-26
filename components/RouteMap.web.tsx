import { createElement } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';

type RouteMapProps = {
  route: RouteDefinition;
  trips: TripSnapshot[];
  height?: number;
  selectedTripId?: string | null;
  onSelectTrip?: (tripId: string) => void;
};

function getEmbedUrl(route: RouteDefinition, selectedTrip?: TripSnapshot) {
  const points = [...route.path, ...route.stops.map((stop) => stop.location)];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPadding = Math.max(0.02, (maxLat - minLat) * 0.08);
  const lngPadding = Math.max(0.02, (maxLng - minLng) * 0.08);
  const bbox = [minLng - lngPadding, minLat - latPadding, maxLng + lngPadding, maxLat + latPadding].join(',');
  const marker = selectedTrip ? `&marker=${selectedTrip.position.latitude},${selectedTrip.position.longitude}` : '';

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik${marker}`;
}

export default function RouteMap({ route, trips, height = 330, selectedTripId, onSelectTrip }: RouteMapProps) {
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? trips[0];
  const map = createElement('iframe', {
    src: getEmbedUrl(route, selectedTrip),
    title: `${route.name} OpenStreetMap`,
    loading: 'lazy',
    referrerPolicy: 'strict-origin-when-cross-origin',
    style: { width: '100%', height: '100%', border: 0, display: 'block' },
  });

  return (
    <View style={[styles.container, { height }]}> 
      {map}
      <View style={[styles.routePill, { backgroundColor: route.color }]}>
        <Text style={styles.routePillText}>{route.code}</Text>
      </View>
      {trips.length > 1 ? (
        <View style={styles.busPicker}>
          {trips.map((trip) => (
            <Text key={trip.id} onPress={() => onSelectTrip?.(trip.id)} style={[styles.busText, trip.id === selectedTrip?.id && styles.busTextSelected]}>
              {trip.busCode}
            </Text>
          ))}
        </View>
      ) : null}
      <View style={styles.attribution}>
        <Text style={styles.attributionText}>© OpenStreetMap contributors</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 28, overflow: 'hidden', backgroundColor: '#E8EEF4' },
  routePill: { position: 'absolute', top: 14, left: 14, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  routePillText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  busPicker: { position: 'absolute', top: 14, right: 14, flexDirection: 'row', gap: 6, padding: 5, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.94)' },
  busText: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, color: '#475569', fontSize: 10, fontWeight: '700' },
  busTextSelected: { backgroundColor: '#D3E4FF', color: '#005EA4' },
  attribution: { position: 'absolute', right: 6, bottom: 5, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.9)' },
  attributionText: { color: '#334155', fontSize: 9 },
});
