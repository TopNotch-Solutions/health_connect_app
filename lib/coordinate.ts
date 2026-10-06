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

  // GeoJSON format from MongoDB: { type: "Point", coordinates: [lng, lat] }
  // Prefer this before lat/lng fields — some payloads include null lat/lng alongside GeoJSON.
  if (Array.isArray(coord.coordinates) && coord.coordinates.length >= 2) {
    const longitude = Number(coord.coordinates[0]);
    const latitude = Number(coord.coordinates[1]);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
  }

  // Already in correct format
  if (coord.latitude != null && coord.longitude != null) {
    const latitude = Number(coord.latitude);
    const longitude = Number(coord.longitude);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
  }
  
  // Plain array format [lng, lat]
  if (Array.isArray(coord) && coord.length >= 2) {
    const longitude = Number(coord[0]);
    const latitude = Number(coord[1]);
    if (!isNaN(latitude) && !isNaN(longitude)) {
      return { latitude, longitude };
    }
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

/** Resolve patient coordinates from a consultation request object. */
export const getPatientLocationFromRequest = (request: {
  address?: { coordinates?: unknown };
  locationTracking?: {
    patientLocation?: { latitude?: number; longitude?: number };
  };
} | null | undefined): NormalizedCoordinate | null => {
  if (!request) return null;

  const candidates = [
    request.address?.coordinates,
    request.locationTracking?.patientLocation,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCoordinate(candidate);
    if (!normalized || !isValidCoordinate(normalized)) continue;
    // Schema default [0, 0] means "unset" — treat as missing
    if (normalized.latitude === 0 && normalized.longitude === 0) continue;
    return normalized;
  }

  return null;
};

/** Extract provider id whether populated or stored as a plain id. */
export const getRequestProviderId = (request: {
  providerId?: unknown;
} | null | undefined): string | null => {
  if (!request?.providerId) return null;
  const provider = request.providerId as any;
  if (typeof provider === "string" || typeof provider === "number") {
    return String(provider);
  }
  if (provider?._id) return String(provider._id);
  if (provider?.id) return String(provider.id);
  if (provider?.userId) return String(provider.userId);
  return null;
};