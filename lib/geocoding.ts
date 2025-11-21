import * as Location from 'expo-location';

interface AddressComponent {
  route?: string;
  locality?: string;
  administrative_area_level_1?: string;
}

/**
 * Converts latitude and longitude to a human-readable address
 * using expo-location's reverse geocoding
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<AddressComponent> => {
  try {
    const results = await Location.reverseGeocodeAsync({
      latitude,
      longitude,
    });

    if (results && results.length > 0) {
      const address = results[0];
      
      return {
        route: `${address.streetNumber || ''} ${address.street || ''}`.trim() || 'Unknown Street',
        locality: address.city || address.district || 'Unknown City',
        administrative_area_level_1: address.region || 'Unknown Region',
      };
    }

    // Return default values if no results
    return {
      route: 'Patient Location',
      locality: 'Current City',
      administrative_area_level_1: 'Current Region',
    };
  } catch (error) {
    console.error('Error in reverse geocoding:', error);
    
    // Return default values on error
    return {
      route: 'Patient Location',
      locality: 'Current City',
      administrative_area_level_1: 'Current Region',
    };
  }
};

/**
 * Gets current location and returns both coordinates and address
 */
export const getCurrentLocationWithAddress = async () => {
  try {
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const address = await reverseGeocode(
      location.coords.latitude,
      location.coords.longitude
    );

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      address,
    };
  } catch (error) {
    console.error('Error getting current location:', error);
    throw error;
  }
};
