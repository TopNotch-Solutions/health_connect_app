import { calculateDistance, calculateEstimatedArrival, formatDistance } from '../../lib/distance';

describe('distance utils', () => {
  it('calculates haversine distance (approx)', () => {
    const d = calculateDistance(0, 0, 0, 1); // ~111.2 km at equator
    expect(d).toBeCloseTo(111.2, 1);
  });

  it('formats ETA under a minute and one minute', () => {
    expect(calculateEstimatedArrival(0.3)).toBe('Less than 1 minute');
    expect(calculateEstimatedArrival(0.5)).toBe('1 minute');
  });

  it('formats ETA in minutes', () => {
    expect(calculateEstimatedArrival(10)).toBe('15 minutes');
  });

  it('formats ETA in hours and hours+minutes', () => {
    expect(calculateEstimatedArrival(80)).toBe('2 hours');
    expect(calculateEstimatedArrival(90)).toBe('2 hours 15 minutes');
  });

  it('formats distance in meters and km', () => {
    expect(formatDistance(0.5)).toBe('500 m');
    expect(formatDistance(1.2)).toBe('1.2 km');
  });
});
