import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Linking,
  Platform,
  Image,
} from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Feather } from '@expo/vector-icons';
import socketService from '../lib/socket';

interface ProviderRouteModalProps {
  visible: boolean;
  onClose: () => void;
  requestId: string;
  providerId: string;
  patientLocation?: {
    latitude: number;
    longitude: number;
  };
  patientAddress?: string;
  patientName?: string;
  providerProfileImage?: string;
  patientProfileImage?: string;
  onCompleteRoute?: () => void;
}

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.05;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

const GOOGLE_MAPS_API_KEY = 'AIzaSyDB4Yr4oq_ePtBKd8_HZSEd0_xi-UId6Fg';
const IMAGE_BASE_URL = 'http://13.51.207.99:4000/images/';
const [mapReady, setMapReady] = useState(false);


// ✅ Helper to normalize coordinates (handles both formats)
const normalizeCoordinate = (coord: any): { latitude: number; longitude: number } | null => {
  // Already in correct format
  if (coord?.latitude !== undefined && coord?.longitude !== undefined) {
    return {
      latitude: Number(coord.latitude),
      longitude: Number(coord.longitude),
    };
  }
  
  // GeoJSON format from MongoDB: { type: "Point", coordinates: [lng, lat] }
  if (coord?.type === 'Point' && Array.isArray(coord?.coordinates) && coord.coordinates.length === 2) {
    return {
      latitude: Number(coord.coordinates[1]),  // GeoJSON is [lng, lat]
      longitude: Number(coord.coordinates[0]),
    };
  }
  
  // Plain array format [lng, lat]
  if (Array.isArray(coord) && coord.length === 2) {
    return {
      latitude: Number(coord[1]),
      longitude: Number(coord[0]),
    };
  }
  
  return null;
};

// ✅ Helper to validate coordinates
const isValidCoordinate = (coord: any): coord is { latitude: number; longitude: number } => {
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

export default function ProviderRouteModal({
  visible,
  onClose,
  requestId,
  providerId,
  patientLocation: rawPatientLocation,
  patientAddress,
  patientName = 'Patient',
  providerProfileImage,
  patientProfileImage,
  onCompleteRoute,
}: ProviderRouteModalProps) {
  const mapRef = useRef<MapView>(null);
  const routeInitializedRef = useRef(false);
  const locationSubscriptionRef = useRef<any>(null);
  const arrivedRef = useRef(false);
  const lastEmitRef = useRef(0);
  const hasFittedRouteRef = useRef(false);


  
  // ✅ Normalize patient location on mount
  const patientLocation = normalizeCoordinate(rawPatientLocation);
  const [providerLocation, setProviderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [lastSpeechTime, setLastSpeechTime] = useState<number>(0);
  

  // ✅ Validate patient location on mount
  useEffect(() => {
    if (visible && !isValidCoordinate(patientLocation)) {
      console.error('❌ Invalid patient location:', patientLocation);
      Alert.alert('Error', 'Invalid patient location coordinates');
      onClose();
    }
  }, [visible, patientLocation, onClose]);

  // Stop speech when modal closes
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = (text: string) => {
    Speech.speak(text, {
      language: 'en',
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const openExternalMaps = () => {
    if (!isValidCoordinate(patientLocation)) {
      Alert.alert('Error', 'Invalid patient location');
      return;
    }
    
    const scheme = Platform.select({ ios: 'maps:0,0?q=', android: 'geo:0,0?q=' });
    const latLng = `${patientLocation.latitude},${patientLocation.longitude}`;
    const label = patientName;
    
    const query = patientAddress && patientAddress.length > 5 
      ? encodeURIComponent(patientAddress) 
      : latLng;

    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${query}(${label})`
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const fetchGoogleMapsRoute = useCallback(async (
    start: { latitude: number; longitude: number }, 
    end: { latitude: number; longitude: number }
  ) => {
    try {
      const destination = patientAddress && patientAddress.length > 5 
        ? encodeURIComponent(patientAddress) 
        : `${end.latitude},${end.longitude}`;

      const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${start.latitude},${start.longitude}&destination=${destination}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;
      
      console.log(`🗺️ Fetching driving directions to ${destination}...`);
      const response = await fetch(url);
      const data = await response.json();

      if (data.status === 'OK' && data.routes.length > 0) {
        const route = data.routes[0];
        const leg = route.legs[0];

        // Just extract the polyline, we're not doing step-by-step navigation anymore
        const points = decodePolyline(route.overview_polyline.points);
        setRouteCoordinates(points);

        const distanceInMeters = leg.distance.value;
        const distanceInKm = distanceInMeters / 1000;
        const durationInSeconds = leg.duration.value;
        const durationInMinutes = Math.round(durationInSeconds / 60);

      setDistance(distanceInKm);
      setDuration(durationInMinutes);
      setRouteDistance(distanceInKm);
      setRouteDuration(durationInMinutes);

      console.log(`🗺️ Route fetched: ${distanceInKm.toFixed(1)} km, ${durationInMinutes} min`);
      return { distanceInKm, durationInMinutes };
      } else {
        console.error('❌ Google Maps API Error:', data.status, data.error_message);
        throw new Error(`Google Maps API Error: ${data.status}`);
      }
    } catch (error) {
      console.error('❌ Error fetching directions, falling back to straight line:', error);
      
      setRouteCoordinates([start, end]);
      
      const R = 6371;
      const dLat = deg2rad(end.latitude - start.latitude);
      const dLon = deg2rad(end.longitude - start.longitude);
      const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(deg2rad(start.latitude)) * Math.cos(deg2rad(end.latitude)) * 
        Math.sin(dLon/2) * Math.sin(dLon/2); 
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      const d = R * c;
      
      setDistance(d);
      const fallbackDuration = Math.round((d / 40) * 60);
      setDuration(fallbackDuration);
      setRouteDistance(d);
      setRouteDuration(fallbackDuration);
      
      speak(`Starting route to ${patientName}. Distance is ${d.toFixed(1)} kilometers.`);
      setLastSpeechTime(Date.now());
      
      return { distanceInKm: d, durationInMinutes: fallbackDuration };
    }
  }, [patientName, patientAddress]);

  const deg2rad = (deg: number) => {
    return deg * (Math.PI/180);
  };

  const decodePolyline = (encoded: string): { latitude: number; longitude: number }[] => {
    const points: { latitude: number; longitude: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let b;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) ? ~(result >> 1) : result >> 1;
      lat += dlat;

      result = 0;
      shift = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const d = R * c;
    return d;
  };

  const initializeRoute = useCallback(async () => {
    if (!isValidCoordinate(patientLocation)) {
      Alert.alert('Error', 'Patient location not available');
      return;
    }

    setIsLoading(true);
    try {
      console.log('📍 Getting provider current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const providerCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // ✅ Validate before setting
      if (!isValidCoordinate(providerCoords)) {
        throw new Error('Invalid provider location');
      }

      setProviderLocation(providerCoords);

      await fetchGoogleMapsRoute(providerCoords, patientLocation);

      if (mapRef.current) {
        setTimeout(() => {
          const points = [providerCoords, patientLocation];
          mapRef.current?.fitToCoordinates(points, {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }, 500);
      }
    } catch (error) {
      console.error('Error initializing route:', error);
      Alert.alert('Error', 'Failed to initialize route. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [patientLocation, fetchGoogleMapsRoute]);

  const startTracking = useCallback(async () => {
    try {
      console.log('🚗 Starting real-time location tracking...');
      setIsTracking(true);

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for route tracking');
        setIsTracking(false);
        return;
      }

      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 20000, // Update every 15 seconds to reduce server load
          distanceInterval: 150, // Update every 100 meters
        },
        async (location) => {
          const newProviderLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          // ✅ Validate before setting
          if (!isValidCoordinate(newProviderLocation)) {
            console.warn('⚠️ Invalid location update received');
            return;
          }

          setProviderLocation(newProviderLocation);
          const now = Date.now();
          // Emit at most once every 10 seconds
          if (now - lastEmitRef.current > 10000) {
            socketService.updateProviderLocation(
              requestId,
              providerId,
              newProviderLocation
            );
            lastEmitRef.current = now;
          }

          if (isValidCoordinate(patientLocation)) {
            try {
              // Calculate distance to destination
              const distToDest = calculateDistance(
                newProviderLocation.latitude,
                newProviderLocation.longitude,
                patientLocation.latitude,
                patientLocation.longitude
              );
              
              // Speech logic - only speak once per minute
              const currentTime = Date.now();
              const oneMinuteInMs = 60 * 1000; // 60 seconds in milliseconds
              const timeSinceLastSpeech = currentTime - lastSpeechTime;

              // Only speak arrival once (guard with ref) - always announce arrival
              if (distToDest < 0.1 && !arrivedRef.current) {
                arrivedRef.current = true;
                speak("You have arrived at the destination.");
                setLastSpeechTime(currentTime);
              } else if (distToDest >= 0.1 && timeSinceLastSpeech >= oneMinuteInMs) {
                // Only speak distance updates if at least 1 minute has passed
                const eta = Math.round((distToDest / 40) * 60);
                speak(`You are ${distToDest.toFixed(1)} kilometers away. About ${eta} minutes remaining.`);
                setLastSpeechTime(currentTime);
              }

            } catch (error) {
              console.error('Error calculating distance:', error);
            }
          }

          // Animate map to provider location - DISABLED to allow user to pan map
          // if (mapRef.current) {
          //   mapRef.current.animateToRegion(
          //     {
          //       ...newProviderLocation,
          //       latitudeDelta: LATITUDE_DELTA,
          //       longitudeDelta: LONGITUDE_DELTA,
          //     },
          //     500
          //   );
          // }
        }
      );

      console.log('✅ Location tracking started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
      setIsTracking(false);
    }
  }, [requestId, providerId, patientLocation]);

  const stopTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);
    console.log('🛑 Location tracking stopped');
  }, []);

  const handleArrived = useCallback(async () => {
    try {
      stopTracking();

      console.log('✅ Marking provider as arrived');
      if (!isValidCoordinate(providerLocation)) {
        Alert.alert('Error', 'Current location not available');
        return;
      }

      if (!requestId) {
        console.error('Error: requestId is missing');
        Alert.alert('Error', 'Request ID is missing');
        return;
      }

      console.log('📤 Updating request status to arrived with location:', providerLocation);
      await socketService.updateRequestStatus(requestId, providerId, 'arrived', providerLocation);

      Alert.alert('Success', "You've arrived at the patient's location!");

      if (onCompleteRoute) {
        onCompleteRoute();
      }

      onClose();
    } catch (error: any) {
      console.error('Error marking as arrived:', error);
      Alert.alert('Error', error.message || 'Failed to mark as arrived');
    }
  }, [requestId, providerLocation, onClose, onCompleteRoute, stopTracking]);

  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      stopTracking();
      
      Alert.alert(
        'Cancel Request',
        'Are you sure you want to cancel this request? The patient will be notified.',
        [
          {
            text: 'Keep Request',
            onPress: () => {
              setIsCancelling(false);
              startTracking();
            },
            style: 'cancel',
          },
          {
            text: 'Cancel Request',
            onPress: async () => {
              try {
                console.log('📤 Cancelling request...');
                await socketService.cancelRequest(requestId, 'provider', 'Provider cancelled the request');
                Alert.alert('Cancelled', 'Request has been cancelled');
                onClose();
              } catch (error: any) {
                console.error('Error cancelling request:', error);
                Alert.alert('Error', error.message || 'Failed to cancel request');
                setIsCancelling(false);
                startTracking();
              }
            },
            style: 'destructive',
          },
        ]
      );
    } catch (error) {
      console.error('Error in handleCancel:', error);
      setIsCancelling(false);
    }
  }, [requestId, onClose, stopTracking, startTracking]);

  useEffect(() => {
    if (visible && isValidCoordinate(patientLocation)) {
      if (!routeInitializedRef.current) {
        routeInitializedRef.current = true;
        initializeRoute();
      }
    } else if (!visible) {
      routeInitializedRef.current = false;
    }
  }, [visible, patientLocation, initializeRoute]);

  useEffect(() => {
    if (visible && mapReady) {
      startTracking();
    } else {
      stopTracking();
    }
    return () => {
      stopTracking();
    };
  }, [visible, startTracking, stopTracking, mapReady]);

  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  // ✅ Don't render map until we have valid coordinates
  if (!isValidCoordinate(patientLocation)) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <View style={styles.container}>
          <View style={styles.errorContainer}>
            <Feather name="alert-circle" size={48} color="#ef4444" />
            <Text style={styles.errorText}>Invalid patient location</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeErrorButton}>
              <Text style={styles.closeErrorButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ✅ Use patient location as fallback for initial region
  const initialRegion = isValidCoordinate(providerLocation)
    ? {
        ...providerLocation,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      }
    : {
        ...patientLocation,
        latitudeDelta: LATITUDE_DELTA,
        longitudeDelta: LONGITUDE_DELTA,
      };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
        <MapView
          onMapReady={() => setMapReady(false)}
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation={true}
          followsUserLocation={false}
          showsMyLocationButton={true}
          initialRegion={initialRegion}
        >
          {/* ✅ Only render marker if coordinate is valid */}
          {isValidCoordinate(providerLocation) && (
            <Marker
              coordinate={providerLocation}
              title="Your Location"
              description="You are here"
              identifier="provider"
            >
              <View style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                borderWidth: 4,
                borderColor: '#FFFFFF',
                backgroundColor: '#3B82F6',
                overflow: 'hidden',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
                justifyContent: 'center',
                alignItems: 'center',
              }}>
                {providerProfileImage ? (
                  <Image
                    source={{ uri: `${IMAGE_BASE_URL}${providerProfileImage}` }}
                    style={{ width: '100%', height: '100%' }}
                    resizeMode="cover"
                    onError={(error) => {
                      console.log('Failed to load provider profile image:', error);
                    }}
                  />
                ) : (
                  <Feather name="navigation" size={24} color="white" />
                )}
              </View>
            </Marker>
          )}

          {/* ✅ Patient marker - already validated above */}
          <Marker
            coordinate={patientLocation}
            title={`${patientName}'s Location`}
            description="Patient destination"
            identifier="patient"
          >
            <View style={{
              width: 50,
              height: 50,
              borderRadius: 25,
              borderWidth: 4,
              borderColor: '#FFFFFF',
              backgroundColor: '#EF4444',
              overflow: 'hidden',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.3,
              shadowRadius: 4,
              elevation: 5,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {patientProfileImage ? (
                <Image
                  source={{ uri: `${IMAGE_BASE_URL}${patientProfileImage}` }}
                  style={{ width: '100%', height: '100%' }}
                  resizeMode="cover"
                  onError={(error) => {
                    console.log('Failed to load patient profile image:', error);
                  }}
                />
              ) : (
                <Feather name="map-pin" size={24} color="white" />
              )}
            </View>
          </Marker>
          
        </MapView>

        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            disabled={isLoading || isCancelling}
          >
            <Feather name="x" size={24} color="#666" />
          </TouchableOpacity>

          <View style={styles.infoSection}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <>
                <Text style={styles.distanceText}>
                  {routeDistance !== null ? routeDistance.toFixed(1) : distance.toFixed(1)} km away
                </Text>
                <Text style={styles.durationText}>
                  ~{routeDuration !== null ? Math.round(routeDuration) : duration} min ETA
                </Text>
                {routeDistance !== null && routeDuration !== null && (
                  <Text style={styles.routeInfoText}>
                    Road route • {routeDistance.toFixed(1)} km • {Math.round(routeDuration)} min
                  </Text>
                )}
              </>
            )}
          </View>
        </View>

        <View style={styles.bottomBar}>
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Heading to {patientName} via road route</Text>
            {routeDistance !== null && routeDuration !== null && (
              <View style={styles.routeInfoContainer}>
                <View style={styles.routeInfoRow}>
                  <Feather name="map" size={14} color="#4F46E5" />
                  <Text style={styles.routeInfoLabel}>Route Distance: </Text>
                  <Text style={styles.routeInfoValue}>{routeDistance.toFixed(1)} km</Text>
                </View>
                <View style={styles.routeInfoRow}>
                  <Feather name="clock" size={14} color="#4F46E5" />
                  <Text style={styles.routeInfoLabel}>Route Duration: </Text>
                  <Text style={styles.routeInfoValue}>{Math.round(routeDuration)} min</Text>
                </View>
              </View>
            )}
            {isTracking && (
              <View style={styles.trackingIndicator}>
                <View style={styles.trackingDot} />
                <Text style={styles.trackingText}>Live tracking active</Text>
              </View>
            )}
          </View>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.cancelButton, isCancelling && styles.disabledButton]}
              onPress={handleCancel}
              disabled={isLoading || isCancelling}
            >
              <Feather name="x-circle" size={20} color="#ef4444" />
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.arrivedButton, isLoading && styles.disabledButton]}
              onPress={handleArrived}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check-circle" size={20} color="#fff" />
                  <Text style={styles.arrivedButtonText}>Mark as Arrived</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.externalMapButton}
            onPress={openExternalMaps}
          >
            <Feather name="map" size={20} color="#4F46E5" />
            <Text style={styles.externalMapButtonText}>Open in Google Maps</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  map: {
    flex: 1,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 15,
    paddingBottom: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    zIndex: 10,
    gap: 15,
  },
  closeButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#f5f5f5',
  },
  infoSection: {
    flex: 1,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  durationText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  routeInfoText: {
    fontSize: 11,
    color: '#4F46E5',
    marginTop: 2,
    fontWeight: '500',
  },
  routeInfoContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    gap: 4,
  },
  routeInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  routeInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  routeInfoValue: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 15,
    paddingVertical: 20,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    zIndex: 10,
  },
  statusInfo: {
    marginBottom: 15,
  },
  statusLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 8,
  },
  trackingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4F46E5',
  },
  trackingText: {
    fontSize: 12,
    color: '#4F46E5',
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  cancelButton: {
    flexDirection: 'row',
    backgroundColor: '#fee2e2',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    flex: 0.4,
    borderWidth: 1,
    borderColor: '#fecaca',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: '600',
  },
  arrivedButton: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    flex: 0.6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  arrivedButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  externalMapButton: {
    flexDirection: 'row',
    backgroundColor: '#EEF2FF',
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  externalMapButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 24,
  },
  closeErrorButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  closeErrorButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});