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

const WEB_TILE_ZOOM = 9;

function longitudeToTileX(longitude: number, zoom: number) {
  return ((longitude + 180) / 360) * 2 ** zoom;
}

function latitudeToTileY(latitude: number, zoom: number) {
  const radians = (latitude * Math.PI) / 180;
  return ((1 - Math.asinh(Math.tan(radians)) / Math.PI) / 2) * 2 ** zoom;
}

function projectToMap(route: RouteDefinition, latitude: number, longitude: number) {
  const bounds = getBounds(route);
  const minX = longitudeToTileX(bounds.minLng, WEB_TILE_ZOOM);
  const maxX = longitudeToTileX(bounds.maxLng, WEB_TILE_ZOOM);
  const minY = latitudeToTileY(bounds.maxLat, WEB_TILE_ZOOM);
  const maxY = latitudeToTileY(bounds.minLat, WEB_TILE_ZOOM);
  return {
    left: ((longitudeToTileX(longitude, WEB_TILE_ZOOM) - minX) / (maxX - minX)) * 100,
    top: ((latitudeToTileY(latitude, WEB_TILE_ZOOM) - minY) / (maxY - minY)) * 100,
  };
}

function WebTileSurface({ route }: { route: RouteDefinition }) {
  const bounds = getBounds(route);
  const minX = longitudeToTileX(bounds.minLng, WEB_TILE_ZOOM);
  const maxX = longitudeToTileX(bounds.maxLng, WEB_TILE_ZOOM);
  const minY = latitudeToTileY(bounds.maxLat, WEB_TILE_ZOOM);
  const maxY = latitudeToTileY(bounds.minLat, WEB_TILE_ZOOM);
  const tiles = [];

  for (let x = Math.floor(minX); x <= Math.floor(maxX); x += 1) {
    for (let y = Math.floor(minY); y <= Math.floor(maxY); y += 1) {
      tiles.push(createElement('img', {
        key: `${x}-${y}`,
        src: `https://tile.openstreetmap.org/${WEB_TILE_ZOOM}/${x}/${y}.png`,
        alt: '',
        loading: 'lazy',
        referrerPolicy: 'strict-origin-when-cross-origin',
        draggable: false,
        style: {
          position: 'absolute',
          left: `${((x - minX) / (maxX - minX)) * 100}%`,
          top: `${((y - minY) / (maxY - minY)) * 100}%`,
          width: `${(1 / (maxX - minX)) * 100 + 0.2}%`,
          height: `${(1 / (maxY - minY)) * 100 + 0.2}%`,
          maxWidth: 'none',
          userSelect: 'none',
        },
      }));
    }
  }

  return createElement('div', {
    role: 'img',
    'aria-label': `${route.name} route map`,
    style: { position: 'absolute', inset: 0, overflow: 'hidden', background: '#DCE9F2' },
  }, tiles);
}

export default function RouteMap({ route, trips, height = 330, selectedTripId, onSelectTrip }: RouteMapProps) {
  const selectedTrip = trips.find((trip) => trip.id === selectedTripId) ?? trips[0];

  return (
    <View style={[styles.container, { height }]}> 
      <WebTileSurface route={route} />
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
  const { left, top } = projectToMap(route, trip.position.latitude, trip.position.longitude);
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
