/**
 * Calculate distance between two coordinates using Haversine formula
 * @param lat1 - Provider latitude
 * @param lon1 - Provider longitude
 * @param lat2 - Patient latitude
 * @param lon2 - Patient longitude
 * @returns Distance in kilometers
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
};

/**
 * Convert degrees to radians
 */
const toRad = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Calculate estimated arrival time based on distance
 * Assumes average speed of 40 km/h for vehicle travel
 * @param distanceInKm - Distance in kilometers
 * @returns Estimated arrival time as a formatted string (e.g., "15 minutes")
 */
export const calculateEstimatedArrival = (distanceInKm: number): string => {
  const averageSpeedKmH = 40; // Average speed in km/h
  const timeInHours = distanceInKm / averageSpeedKmH;
  const timeInMinutes = Math.round(timeInHours * 60);

  if (timeInMinutes < 1) {
    return "Less than 1 minute";
  } else if (timeInMinutes === 1) {
    return "1 minute";
  } else if (timeInMinutes < 60) {
    return `${timeInMinutes} minutes`;
  } else {
    const hours = Math.floor(timeInMinutes / 60);
    const minutes = timeInMinutes % 60;
    if (minutes === 0) {
      return `${hours} hour${hours > 1 ? "s" : ""}`;
    }
    return `${hours} hour${hours > 1 ? "s" : ""} ${minutes} minutes`;
  }
};

/**
 * Format distance for display
 * @param distanceInKm - Distance in kilometers
 * @returns Formatted distance string (e.g., "2.5 km")
 */
export const formatDistance = (distanceInKm: number): string => {
  if (distanceInKm < 1) {
    return `${Math.round(distanceInKm * 1000)} m`;
  }
  return `${distanceInKm} km`;
};
