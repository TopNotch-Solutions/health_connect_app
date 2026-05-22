import * as Location from "expo-location";
import Geolocation from "react-native-geolocation-service";
import { ensureForegroundLocationPermission } from "./locationPermission";

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
 * Gets current location using expo-location primarily (most compatible with Expo)
 * Falls back to Geolocation service if available
 */
const getCurrentLocationCoordinates = async (): Promise<{
  latitude: number;
  longitude: number;
}> => {
  try {
    console.log('📍 Attempting to get location with expo-location...');
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });
    console.log('✅ Successfully got location from expo-location:', location.coords);
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (expoError) {
    console.warn('⚠️ expo-location failed, trying Geolocation service:', expoError);

    // Fallback to Geolocation service
    try {
      return await new Promise((resolve, reject) => {
        if (!Geolocation) {
          reject(new Error('Geolocation service not available'));
          return;
        }

        const timeout = setTimeout(() => {
          reject(new Error('Geolocation timeout'));
        }, 15000);

        Geolocation.getCurrentPosition(
          (position) => {
            clearTimeout(timeout);
            console.log('✅ Successfully got location from Geolocation service:', position.coords);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
          },
          (error) => {
            clearTimeout(timeout);
            console.warn('❌ Geolocation service error:', error);
            reject(error);
          },
          {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 10000,
          }
        );
      });
    } catch (geolocationError) {
      console.error('❌ Both location services failed:', geolocationError);
      throw new Error('Failed to get current location. Please ensure:\n1. Location services are enabled\n2. App has location permissions\n3. GPS is available');
    }
  }
};

/**
 * Gets current location and returns both coordinates and address
 * Handles permissions and provides better error handling
 */
export const getCurrentLocationWithAddress = async (options?: {
  requestPermission?: boolean;
}) => {
  try {
    const { granted } = await ensureForegroundLocationPermission({
      requestIfNeeded: options?.requestPermission !== false,
    });
    if (!granted) {
      throw new Error(
        "Location permission denied. Please enable location access in settings.",
      );
    }

    // Get location coordinates with fallback mechanism
    const coords = await getCurrentLocationCoordinates();

    // Get address from coordinates
    const address = await reverseGeocode(coords.latitude, coords.longitude);

    return {
      latitude: coords.latitude,
      longitude: coords.longitude,
      address,
    };
  } catch (error: any) {
    console.error('Error getting current location:', error);
    throw error;
  }
};

/**
 * Gets current location only (coordinates without address lookup)
 * Useful for quick location checks
 */
export const getLocationCoordinates = async (options?: {
  requestPermission?: boolean;
}) => {
  try {
    const { granted } = await ensureForegroundLocationPermission({
      requestIfNeeded: options?.requestPermission !== false,
    });
    if (!granted) {
      throw new Error("Location permission denied.");
    }

    return await getCurrentLocationCoordinates();
  } catch (error: any) {
    console.error('Error getting location coordinates:', error);
    throw error;
  }
};
