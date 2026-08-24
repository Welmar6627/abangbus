import { parseGeographyPoint } from '@/lib/transit-mappers';

describe('parseGeographyPoint', () => {
  test('parses PostGIS WKT longitude and latitude order', () => {
    expect(parseGeographyPoint('POINT(124.609389 11.009037)')).toEqual({
      latitude: 11.009037,
      longitude: 124.609389,
    });
  });

  test('parses GeoJSON points', () => {
    expect(parseGeographyPoint({ type: 'Point', coordinates: [124.983005, 10.38399] })).toEqual({
      latitude: 10.38399,
      longitude: 124.983005,
    });
  });

  test.each([
    null,
    'POINT(NaN 10)',
    'LINESTRING(124 10, 125 11)',
    { type: 'Point', coordinates: [181, 10] },
    { type: 'Point', coordinates: [124, -91] },
    { type: 'Point', coordinates: ['nope', 10] },
  ])('rejects malformed or out-of-range values: %p', (value) => {
    expect(parseGeographyPoint(value)).toBeNull();
  });
});
