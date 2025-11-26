/**
 * Utility functions for normalizing coordinates from various formats
 * Handles: GeoJSON (MongoDB), plain objects, and arrays
 */

export interface NormalizedCoordinate {
  latitude: number;
  longitude: number;
}

/**
 * Normalizes coordinate from any format to { latitude, longitude }
 * 
 * Supports:
 * - { latitude: number, longitude: number }
 * - { type: "Point", coordinates: [lng, lat] } (GeoJSON/MongoDB)
 * - [lng, lat] (array format)
 */
export const normalizeCoordinate = (coord: any): NormalizedCoordinate | null => {
  if (!coord) return null;

  // Already in correct format
  if (coord.latitude !== undefined && coord.longitude !== undefined) {
    return {
      latitude: Number(coord.latitude),
      longitude: Number(coord.longitude),
    };
  }
  
  // GeoJSON format from MongoDB: { type: "Point", coordinates: [lng, lat] }
  // NOTE: GeoJSON uses [longitude, latitude] order!
  if (coord.type === 'Point' && Array.isArray(coord.coordinates) && coord.coordinates.length === 2) {
    return {
      latitude: Number(coord.coordinates[1]),  // lat is second
      longitude: Number(coord.coordinates[0]), // lng is first
    };
  }
  
  // Plain array format [lng, lat]
  if (Array.isArray(coord) && coord.length === 2) {
    return {
      latitude: Number(coord[1]),
      longitude: Number(coord[0]),
    };
  }
  
  console.warn('⚠️ Unknown coordinate format:', coord);
  return null;
};

/**
 * Validates if a coordinate is valid
 */
export const isValidCoordinate = (coord: any): coord is NormalizedCoordinate => {
  const normalized = normalizeCoordinate(coord);
  return (
    normalized !== null &&
    typeof normalized.latitude === 'number' &&
    typeof normalized.longitude === 'number' &&
    !isNaN(normalized.latitude) &&
    !isNaN(normalized.longitude) &&
    Math.abs(normalized.latitude) <= 90 &&
    Math.abs(normalized.longitude) <= 180
  );
};

/**
 * Converts normalized coordinate to GeoJSON format
 * Useful when sending data back to MongoDB
 */
export const toGeoJSON = (coord: NormalizedCoordinate) => {
  return {
    type: 'Point' as const,
    coordinates: [coord.longitude, coord.latitude], // [lng, lat]
  };
};

/**
 * Safely get coordinates with fallback
 */
export const getCoordinateOrDefault = (
  coord: any,
  defaultCoord: NormalizedCoordinate
): NormalizedCoordinate => {
  const normalized = normalizeCoordinate(coord);
  return normalized || defaultCoord;
};

/**
 * Normalize coordinate but return undefined instead of null
 * Useful for optional props that expect undefined
 */
export const normalizeCoordinateOrUndefined = (coord: any): NormalizedCoordinate | undefined => {
  return normalizeCoordinate(coord) || undefined;
};