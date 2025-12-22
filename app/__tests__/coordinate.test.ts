import {
  normalizeCoordinate,
  isValidCoordinate,
  toGeoJSON,
  getCoordinateOrDefault,
  normalizeCoordinateOrUndefined,
} from '../../lib/coordinate';

describe('coordinate utils', () => {
  it('normalizes {latitude, longitude}', () => {
    expect(normalizeCoordinate({ latitude: -22.5, longitude: 17.1 })).toEqual({ latitude: -22.5, longitude: 17.1 });
  });

  it('normalizes GeoJSON Point', () => {
    expect(normalizeCoordinate({ type: 'Point', coordinates: [17.1, -22.5] })).toEqual({ latitude: -22.5, longitude: 17.1 });
  });

  it('normalizes array [lng, lat]', () => {
    expect(normalizeCoordinate([17.1, -22.5])).toEqual({ latitude: -22.5, longitude: 17.1 });
  });

  it('returns null for unknown formats', () => {
    expect(normalizeCoordinate({ foo: 'bar' })).toBeNull();
  });

  it('validates coordinates within bounds', () => {
    expect(isValidCoordinate({ latitude: 0, longitude: 0 })).toBe(true);
    expect(isValidCoordinate({ latitude: 91, longitude: 0 } as any)).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: 181 } as any)).toBe(false);
  });

  it('converts to GeoJSON', () => {
    expect(toGeoJSON({ latitude: -22.5, longitude: 17.1 })).toEqual({ type: 'Point', coordinates: [17.1, -22.5] });
  });

  it('returns default when input invalid', () => {
    const def = { latitude: 1, longitude: 2 };
    expect(getCoordinateOrDefault({ bad: true }, def)).toEqual(def);
  });

  it('returns undefined when cannot normalize', () => {
    expect(normalizeCoordinateOrUndefined({ bad: true })).toBeUndefined();
  });
});
