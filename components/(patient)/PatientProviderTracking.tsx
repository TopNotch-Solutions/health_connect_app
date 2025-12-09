import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import socketService from '../../lib/socket';

const GOOGLE_MAPS_API_KEY = 'AIzaSyDB4Yr4oq_ePtBKd8_HZSEd0_xi-UId6Fg';

interface ProviderLocation {
  latitude: number;
  longitude: number;
  timestamp?: number;
}

interface PatientProviderTrackingProps {
  visible: boolean;
  onClose: () => void;
  requestId: string;
  patientLocation?: { latitude: number; longitude: number } | null;
  providerName: string;
  providerRole?: string;
}

// Helper to normalize and validate coordinates
const normalizeCoordinate = (loc: any): ProviderLocation | null => {
  if (!loc) return null;
  const lat = Number(loc.latitude);
  const lng = Number(loc.longitude);
  if (isNaN(lat) || isNaN(lng)) return null;
  return { latitude: lat, longitude: lng };
};

// Haversine formula to calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
};

// Fetch navigation route from Google Directions API
const fetchRoute = async (
  startLat: number,
  startLng: number,
  endLat: number,
  endLng: number
): Promise<ProviderLocation[]> => {
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`;
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.routes && data.routes.length > 0) {
      const polyline = data.routes[0].overview_polyline.points;
      return decodePolyline(polyline);
    }
    return [];
  } catch (error) {
    console.error('Error fetching route:', error);
    return [];
  }
};

// Decode polyline from Google Directions API
const decodePolyline = (encoded: string): ProviderLocation[] => {
  const inv = 1.0 / 1e5;
  const decoded: ProviderLocation[] = [];
  let previous = [0, 0];
  let i = 0;

  while (i < encoded.length) {
    const ll = [0, 0];
    for (let j = 0; j < 2; j++) {
      let shift = 0;
      let result = 0;
      let byte;
      do {
        byte = encoded.charCodeAt(i++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      ll[j] = previous[j] + (result & 1 ? ~(result >> 1) : result >> 1);
      previous[j] = ll[j];
    }
    decoded.push({
      latitude: ll[0] * inv,
      longitude: ll[1] * inv,
    });
  }

  return decoded;
};

export default function PatientProviderTracking({
  visible,
  onClose,
  requestId,
  patientLocation,
  providerName,
  providerRole = 'provider',
}: PatientProviderTrackingProps) {
  const mapViewRef = useRef<MapView>(null);
  const [providerLocation, setProviderLocation] = useState<ProviderLocation | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [routeCoordinates, setRouteCoordinates] = useState<ProviderLocation[]>([]);
  const [currentPatientLocation, setCurrentPatientLocation] = useState<ProviderLocation | null>(patientLocation || null);
  const [lastSpokenDistance, setLastSpokenDistance] = useState<number>(0);
  const [hasSpokenArrival, setHasSpokenArrival] = useState(false);

  // Speak text
  const speak = (text: string) => {
    Speech.speak(text, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const initializeTracking = () => {
    if (!requestId) return;

    console.log('🔍 Initializing patient-side provider tracking for request:', requestId);
    setIsLoading(true);

    // Request initial provider location with a timeout and retry logic
    return new Promise<void>((resolve) => {
      let received = false;
      let retryCount = 0;
      const maxRetries = 3;
      const retryDelay = 2000; // Retry every 2 seconds

      const attemptGetLocation = () => {
        if (received) return;

        console.log(`📍 Attempting to fetch provider location (attempt ${retryCount + 1}/${maxRetries})...`);

        const timeout = setTimeout(() => {
          if (!received) {
            retryCount++;
            if (retryCount < maxRetries) {
              console.log(`⚠️ Attempt ${retryCount} timed out, retrying...`);
              attemptGetLocation();
            } else {
              console.log('❌ Max retries reached, no location available');
              received = true;
              setIsLoading(false);
              resolve();
            }
          }
        }, 5000);

        socketService.getSocket()?.emit('getProviderLocation', { requestId }, (location: ProviderLocation) => {
          if (!received) {
            received = true;
            clearTimeout(timeout);

            const normalizedLocation = normalizeCoordinate(location);
            if (normalizedLocation) {
              console.log('📍 Initial provider location received:', normalizedLocation);
              setProviderLocation(normalizedLocation);
              setRouteCoordinates([normalizedLocation]);

              // Calculate distance
              if (currentPatientLocation) {
                const dist = calculateDistance(
                  currentPatientLocation.latitude,
                  currentPatientLocation.longitude,
                  normalizedLocation.latitude,
                  normalizedLocation.longitude
                );
                setDistance(dist);
                
                // Initial announcement
                const eta = Math.round((dist / 40) * 60);
                speak(`Provider ${providerName} is on the way. Estimated arrival in ${eta} minutes.`);
                setLastSpokenDistance(dist);
              }

              setIsLoading(false);
              resolve();
            } else {
              console.log('⚠️ No location data received or invalid coordinates, will retry...');
              retryCount++;
              if (retryCount < maxRetries) {
                setTimeout(attemptGetLocation, retryDelay);
              } else {
                setIsLoading(false);
                resolve();
              }
            }
          }
        });
      };

      attemptGetLocation();
    });
  };

  const startTracking = () => {
    if (!requestId) return;

    console.log('📡 Setting up provider location listener');

      const handleProviderLocationUpdate = (data: any) => {
        const normalizedLocation = normalizeCoordinate(data.location);
        if (data.requestId === requestId && normalizedLocation) {
          console.log('📍 Provider location update:', normalizedLocation);
          setProviderLocation(normalizedLocation);

          // Add to route coordinates only if valid
          setRouteCoordinates((prev) => [...prev, normalizedLocation]);

          // Calculate distance
          if (currentPatientLocation && currentPatientLocation.latitude && currentPatientLocation.longitude) {
            const dist = calculateDistance(
              currentPatientLocation.latitude,
              currentPatientLocation.longitude,
              normalizedLocation.latitude,
              normalizedLocation.longitude
            );
            setDistance(dist);

            // Voice updates logic
            if (dist < 0.1 && !hasSpokenArrival) {
              // Less than 100 meters
              speak(`The ${providerRole} has arrived.`);
              setHasSpokenArrival(true);
            } else if (dist > 0.1 && !hasSpokenArrival) {
              // Announce every 1km change or significant progress
              if (Math.abs(lastSpokenDistance - dist) >= 1.0) {
                 const eta = Math.round((dist / 40) * 60);
                 speak(`Provider is ${dist.toFixed(1)} kilometers away. About ${eta} minutes.`);
                 setLastSpokenDistance(dist);
              }
            }
          }
        }
      };    // Listen for provider location updates
    socketService.getSocket()?.on('updateProviderLocation', handleProviderLocationUpdate);

    return () => {
      socketService.getSocket()?.off('updateProviderLocation', handleProviderLocationUpdate);
    };
  };

  useEffect(() => {
    if (!visible) return;

    let unsubscribe: (() => void) | undefined;

    const init = async () => {
      await initializeTracking();
      unsubscribe = startTracking();
    };

    init();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      } else {
        // If init hasn't finished yet, we need to ensure we don't leave a dangling listener.
        // Since we can't cancel the async init easily, we rely on startTracking returning the cleanup.
        // Ideally, we should refactor to not have this race condition, but for now:
        // We can try to remove the listener directly if we know the event name.
        socketService.getSocket()?.off('updateProviderLocation');
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, requestId]);

  // Stop speech when modal closes or component unmounts
  useEffect(() => {
    if (!visible) {
      Speech.stop();
    }
    return () => {
      Speech.stop();
    };
  }, [visible]);

  // Auto-zoom to fit both locations - Only on initial load or significant changes
  useEffect(() => {
    if (!visible || !mapViewRef.current || !currentPatientLocation || !providerLocation) return;

    // Only fit to coordinates if we haven't done it yet or if it's the first valid location
    // We use a simple check: if routeCoordinates has just 1 item (initial) or we just opened
    // We don't want to re-zoom on every small provider movement
    if (routeCoordinates.length <= 1) {
       setTimeout(() => {
        mapViewRef.current?.fitToCoordinates(
          [
            {
              latitude: currentPatientLocation.latitude,
              longitude: currentPatientLocation.longitude,
            },
            {
              latitude: providerLocation.latitude,
              longitude: providerLocation.longitude,
            },
          ],
          {
            edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
            animated: true,
          }
        );
      }, 500);
    }
  }, [visible, currentPatientLocation]); // Removed providerLocation from dependency to prevent auto-centering on every update

  // Fetch navigation route when both locations are available
  useEffect(() => {
    if (!currentPatientLocation || !providerLocation) return;

    const fetchNavRoute = async () => {
      console.log('🗺️ Fetching navigation route from Google Maps API...');
      console.log('Current Patient Location:', JSON.stringify(currentPatientLocation));
      console.log('Provider Location:', JSON.stringify(providerLocation));
      
      // Validate locations before fetching
      const patientLat = currentPatientLocation?.latitude;
      const patientLng = currentPatientLocation?.longitude;
      const providerLat = providerLocation?.latitude;
      const providerLng = providerLocation?.longitude;

      console.log(`Patient coords: lat=${patientLat}, lng=${patientLng}`);
      console.log(`Provider coords: lat=${providerLat}, lng=${providerLng}`);

      if (!patientLat || !patientLng || !providerLat || !providerLng) {
        console.log('⚠️ Invalid locations, using direct line');
        setRouteCoordinates([providerLocation, currentPatientLocation]);
        return;
      }

      const route = await fetchRoute(
        providerLat,
        providerLng,
        patientLat,
        patientLng
      );
      
      if (route.length > 0 && route.every(point => point.latitude && point.longitude)) {
        console.log('✅ Route received, points:', route.length);
        setRouteCoordinates(route);
      } else {
        console.log('⚠️ No route found or invalid coordinates, using direct line');
        // Fallback to direct line between two points
        setRouteCoordinates([providerLocation, currentPatientLocation]);
      }
    };

    fetchNavRoute();
  }, [currentPatientLocation, providerLocation]);

  // Refresh patient location when modal becomes visible
  useEffect(() => {
    if (!visible) return;

    const refreshPatientLocation = async () => {
      try {
        console.log('📍 Refreshing patient location when modal opens...');
        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        const newPatientLocation = normalizeCoordinate({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
        console.log('✅ Updated patient location:', newPatientLocation);
        if (newPatientLocation) {
          setCurrentPatientLocation(newPatientLocation);
        }
      } catch (error) {
        console.error('Error refreshing patient location:', error);
        // Keep using the passed patientLocation if refresh fails
        if (patientLocation) {
          const normalized = normalizeCoordinate(patientLocation);
          if (normalized) {
            setCurrentPatientLocation(normalized);
          }
        }
      }
    };

    refreshPatientLocation();
  }, [visible, patientLocation]);

  const getETAMinutes = (): number => {
    if (!distance) return 0;
    // Assume average speed of 40 km/h in urban area
    return Math.round((distance / 40) * 60);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 px-4 py-3 flex-row items-center justify-between pt-12">
          <View className="flex-1">
            <Text className="text-xl font-bold text-gray-800">Track Provider</Text>
            <Text className="text-sm text-gray-600 mt-1">{providerName}</Text>
          </View>
          <TouchableOpacity onPress={onClose} className="p-2">
            <Feather name="x" size={24} color="#1f2937" />
          </TouchableOpacity>
        </View>

        {/* Map */}
        {isLoading ? (
          <View className="flex-1 items-center justify-center bg-gray-100">
            <ActivityIndicator size="large" color="#007BFF" />
            <Text className="text-gray-600 mt-4">Loading provider location...</Text>
            <Text className="text-gray-500 text-xs mt-2 text-center px-4">
              If this takes a while, the provider may not have started moving yet
            </Text>
          </View>
        ) : !providerLocation || !currentPatientLocation ? (
          <View className="flex-1 items-center justify-center bg-gray-100">
            <Feather name="alert-circle" size={48} color="#6b7280" />
            <Text className="text-gray-800 font-semibold mt-4">Location Not Available</Text>
            <Text className="text-gray-600 text-center mt-2 px-4">
              {!providerLocation
                ? 'The provider has not started moving yet or has not sent location data. Please ensure they have clicked "Mark as Route" and check back in a moment.'
                : 'Your location could not be determined. Please enable location services.'}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setIsLoading(true);
                initializeTracking();
              }}
              className="mt-6 bg-blue-600 px-6 py-2 rounded-lg"
            >
              <Text className="text-white font-semibold">Retry</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <MapView
              ref={mapViewRef}
              style={{ flex: 1 }}
              initialRegion={{
                latitude: currentPatientLocation?.latitude || -26.2041,
                longitude: currentPatientLocation?.longitude || 28.0473,
                latitudeDelta: 0.05,
                longitudeDelta: 0.05,
              }}
            >
              {/* Patient location marker */}
              {currentPatientLocation && currentPatientLocation.latitude && currentPatientLocation.longitude && (
                <Marker
                  coordinate={{
                    latitude: currentPatientLocation.latitude,
                    longitude: currentPatientLocation.longitude,
                  }}
                  title="Your Location"
                  description="Your current location"
                >
                  <View className="bg-blue-600 rounded-full p-2 border-4 border-white shadow-lg">
                    <Feather name="map-pin" size={20} color="white" />
                  </View>
                </Marker>
              )}

              {/* Provider location marker */}
              {providerLocation && providerLocation.latitude && providerLocation.longitude && (
                <Marker
                  coordinate={{
                    latitude: providerLocation.latitude,
                    longitude: providerLocation.longitude,
                  }}
                  title={providerName}
                  description="Provider's current location"
                >
                  <View className="bg-green-600 rounded-full p-2 border-4 border-white shadow-lg">
                    <Feather name="navigation" size={20} color="white" />
                  </View>
                </Marker>
              )}

              {/* Route polyline - background white for visibility */}
              {routeCoordinates.length > 1 && routeCoordinates.every(point => point.latitude && point.longitude) && (
                <>
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor="#ffffff"
                    strokeWidth={8}
                    lineDashPattern={[0, 0]}
                  />
                  <Polyline
                    coordinates={routeCoordinates}
                    strokeColor="#2563eb"
                    strokeWidth={4}
                    lineDashPattern={[0, 0]}
                  />
                </>
              )}
            </MapView>

            {/* Info card at bottom */}
            <View className="bg-white border-t border-gray-200 px-4 py-4 gap-3">
              {/* Direction info */}
              <View className="bg-blue-50 rounded-lg p-3 border border-blue-200 flex-row items-center">
                <Feather name="navigation" size={18} color="#1e40af" />
                <Text className="text-xs text-blue-900 ml-2 flex-1">
                  Provider is heading towards you
                </Text>
              </View>

              {/* Distance and ETA */}
              <View className="flex-row gap-4">
                <View className="flex-1 bg-blue-50 rounded-lg p-3 border border-blue-200">
                  <Text className="text-xs font-semibold text-blue-900 mb-1">Distance</Text>
                  <Text className="text-lg font-bold text-blue-600">
                    {distance !== null ? distance.toFixed(1) : '--'} km
                  </Text>
                </View>
                <View className="flex-1 bg-green-50 rounded-lg p-3 border border-green-200">
                  <Text className="text-xs font-semibold text-green-900 mb-1">ETA</Text>
                  <Text className="text-lg font-bold text-green-600">
                    {getETAMinutes()} min
                  </Text>
                </View>
              </View>

              {/* Close button */}
              <TouchableOpacity
                onPress={onClose}
                className="bg-gray-200 rounded-lg py-3 flex-row items-center justify-center"
              >
                <Feather name="arrow-down" size={18} color="#374151" />
                <Text className="text-gray-800 font-semibold ml-2">Close Tracking</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}
