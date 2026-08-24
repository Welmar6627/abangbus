import { createElement } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { type RouteDefinition, type TripSnapshot } from '@/lib/abangbus-data';
import { formatTripFreshness, getTripFreshness } from '@/lib/trip-freshness';

type RouteMapProps = {
  route: RouteDefinition;
  trips: TripSnapshot[];
  height?: number;
  selectedTripId?: string | null;
  onSelectTrip?: (tripId: string) => void;
};

function getBounds(route: RouteDefinition) {
  const points = [...route.path, ...route.stops.map((stop) => stop.location)];
  const latitudes = points.map((point) => point.latitude);
  const longitudes = points.map((point) => point.longitude);
  const minLat = Math.min(...latitudes);
  const maxLat = Math.max(...latitudes);
  const minLng = Math.min(...longitudes);
  const maxLng = Math.max(...longitudes);
  const latPadding = Math.max(0.02, (maxLat - minLat) * 0.08);
  const lngPadding = Math.max(0.02, (maxLng - minLng) * 0.08);
  return {
    minLat: minLat - latPadding,
    maxLat: maxLat + latPadding,
    minLng: minLng - lngPadding,
    maxLng: maxLng + lngPadding,
  };
}

function getEmbedUrl(route: RouteDefinition) {
  const bounds = getBounds(route);
  const bbox = [bounds.minLng, bounds.minLat, bounds.maxLng, bounds.maxLat].join(',');

  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(bbox)}&layer=mapnik`;
}

export default function RouteMap({ route, trips, height = 330, selectedTripId, onSelectTrip }: RouteMapProps) {
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? trips[0];
  const map = createElement('iframe', {
    src: getEmbedUrl(route),
    title: `${route.name} OpenStreetMap`,
    loading: 'lazy',
    referrerPolicy: 'strict-origin-when-cross-origin',
    style: { width: '100%', height: '100%', border: 0, display: 'block' },
  });

  return (
    <View style={[styles.container, { height }]}> 
      {map}
      {trips.map((trip) => (
        <WebBusMarker key={trip.id} route={route} trip={trip} selected={trip.id === selectedTrip?.id} onPress={onSelectTrip} />
      ))}
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

function WebBusMarker({ route, trip, selected, onPress }: { route: RouteDefinition; trip: TripSnapshot; selected: boolean; onPress?: (tripId: string) => void }) {
  const bounds = getBounds(route);
  const left = ((trip.position.longitude - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * 100;
  const top = ((bounds.maxLat - trip.position.latitude) / (bounds.maxLat - bounds.minLat)) * 100;
  const freshness = getTripFreshness(trip.lastUpdatedAt);
  const color = freshness === 'live' ? '#006E1C' : freshness === 'delayed' ? '#946F00' : '#64748B';

  return createElement('button', {
    type: 'button',
    onClick: () => onPress?.(trip.id),
    'aria-label': `${trip.busCode}, ${formatTripFreshness(freshness)}, ${Math.round(trip.speedKph)} kilometers per hour`,
    title: `${trip.busCode} · ${formatTripFreshness(freshness)} · ${Math.round(trip.speedKph)} km/h`,
    style: {
      position: 'absolute', left: `${left}%`, top: `${top}%`, zIndex: selected ? 8 : 6,
      width: selected ? 72 : 58, height: selected ? 96 : 78, padding: 0, border: 0,
      background: 'transparent', cursor: onPress ? 'pointer' : 'default',
      transform: 'translate(-50%, -50%)', transition: 'left 7s linear, top 7s linear, opacity 250ms ease',
      opacity: freshness === 'stale' ? 0.62 : 1,
    },
  },
  createElement('span', { style: { position: 'absolute', left: '50%', bottom: 3, width: '65%', height: 10, borderRadius: '50%', background: 'rgba(15,23,42,0.25)', filter: 'blur(4px)', transform: 'translateX(-50%)' } }),
  createElement('span', { style: { display: 'block', width: '100%', height: '100%', transform: `rotate(${trip.bearing || 0}deg)`, transition: 'transform 600ms ease' } },
    createElement(Image, {
      source: require('@/assets/images/live-bus-3d.png'), accessibilityIgnoresInvertColors: true,
      style: { width: '100%', height: '100%', objectFit: 'contain', opacity: freshness === 'stale' ? 0.7 : 1 },
    }),
  ),
  createElement('span', { style: { position: 'absolute', right: -2, top: 2, width: 11, height: 11, borderRadius: '50%', background: color, border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' } }));
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
