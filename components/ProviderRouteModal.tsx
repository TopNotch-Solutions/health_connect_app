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
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import * as Location from 'expo-location';
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
  patientName?: string;
  onCompleteRoute?: () => void;
}

const { width, height } = Dimensions.get('window');
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.05;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function ProviderRouteModal({
  visible,
  onClose,
  requestId,
  providerId,
  patientLocation,
  patientName = 'Patient',
  onCompleteRoute,
}: ProviderRouteModalProps) {
  const mapRef = useRef<MapView>(null);
  const [providerLocation, setProviderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    { latitude: number; longitude: number }[]
  >([]);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const locationSubscriptionRef = useRef<any>(null);

  // Calculate distance using Haversine formula
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

  // Initialize map and route
  const initializeRoute = useCallback(async () => {
    if (!patientLocation) {
      Alert.alert('Error', 'Patient location not available');
      return;
    }

    setIsLoading(true);
    try {
      console.log('📍 Getting provider current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const providerCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      setProviderLocation(providerCoords);

      // Generate route inline
      const dist = calculateDistance(
        providerCoords.latitude,
        providerCoords.longitude,
        patientLocation.latitude,
        patientLocation.longitude
      );

      // Create intermediate points for smoother route visualization
      const points: { latitude: number; longitude: number }[] = [providerCoords];
      const steps = Math.ceil(dist * 10); // More points for smoother line

      for (let i = 1; i < steps; i++) {
        const fraction = i / steps;
        const lat = providerCoords.latitude + (patientLocation.latitude - providerCoords.latitude) * fraction;
        const lon = providerCoords.longitude + (patientLocation.longitude - providerCoords.longitude) * fraction;
        points.push({ latitude: lat, longitude: lon });
      }

      points.push(patientLocation);

      setRouteCoordinates(points);
      setDistance(dist);

      // Calculate estimated time (assuming 40 km/h average speed)
      const avgSpeed = 40;
      const estimatedMinutes = Math.round((dist / avgSpeed) * 60);
      setDuration(estimatedMinutes);

      console.log(`📍 Route generated: ${dist.toFixed(1)} km, ${estimatedMinutes} min`);

      // Animate map to show both locations
      if (mapRef.current && points.length > 0) {
        setTimeout(() => {
          mapRef.current?.fitToCoordinates(points, {
            edgePadding: { top: 100, right: 50, bottom: 100, left: 50 },
            animated: true,
          });
        }, 500);
      }
    } catch (error) {
      console.error('Error initializing route:', error);
      Alert.alert('Error', 'Failed to initialize route');
    } finally {
      setIsLoading(false);
    }
  }, [patientLocation]);

  // Start real-time location tracking
  const startTracking = useCallback(async () => {
    try {
      console.log('🚗 Starting real-time location tracking...');
      setIsTracking(true);

      // Request location permission
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location permission is required for route tracking');
        setIsTracking(false);
        return;
      }

      // Subscribe to location updates
      locationSubscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update every 10 meters
        },
        (location) => {
          const newProviderLocation = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };

          setProviderLocation(newProviderLocation);

          // Emit location update via socket using public method
          socketService.updateProviderLocation(requestId, providerId, newProviderLocation);

          // Update distance to patient
          if (patientLocation) {
            const newDistance = calculateDistance(
              newProviderLocation.latitude,
              newProviderLocation.longitude,
              patientLocation.latitude,
              patientLocation.longitude
            );
            setDistance(newDistance);

            // Recalculate ETA
            const avgSpeed = 40;
            const estimatedMinutes = Math.round((newDistance / avgSpeed) * 60);
            setDuration(estimatedMinutes);
          }

          // Center map on provider
          if (mapRef.current) {
            mapRef.current.animateToRegion(
              {
                ...newProviderLocation,
                latitudeDelta: LATITUDE_DELTA,
                longitudeDelta: LONGITUDE_DELTA,
              },
              500
            );
          }
        }
      );

      console.log('✅ Location tracking started');
    } catch (error) {
      console.error('Error starting location tracking:', error);
      Alert.alert('Error', 'Failed to start location tracking');
      setIsTracking(false);
    }
  }, [requestId, providerId, patientLocation]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);
    console.log('🛑 Location tracking stopped');
  }, []);

  // Mark as arrived
  const handleArrived = useCallback(async () => {
    try {
      stopTracking();

      console.log('✅ Marking provider as arrived');
      if (!providerLocation) {
        Alert.alert('Error', 'Current location not available');
        return;
      }

      if (!requestId) {
        console.error('Error: requestId is missing');
        Alert.alert('Error', 'Request ID is missing');
        return;
      }

      console.log('📤 Updating request status to arrived with location:', providerLocation);
      await socketService.updateRequestStatus(requestId, 'arrived', providerLocation);

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

  // Initialize on mount
  useEffect(() => {
    if (visible && patientLocation) {
      initializeRoute();
    }
  }, [visible, patientLocation, initializeRoute]);

  // Start tracking when modal opens
  useEffect(() => {
    if (visible) {
      startTracking();
    } else {
      stopTracking();
    }

    return () => {
      stopTracking();
    };
  }, [visible, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
    };
  }, [stopTracking]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        {/* Map */}
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={
            providerLocation
              ? {
                  ...providerLocation,
                  latitudeDelta: LATITUDE_DELTA,
                  longitudeDelta: LONGITUDE_DELTA,
                }
              : {
                  latitude: 0,
                  longitude: 0,
                  latitudeDelta: LATITUDE_DELTA,
                  longitudeDelta: LONGITUDE_DELTA,
                }
          }
        >
          {/* Route line - enhanced styling */}
          {routeCoordinates.length > 1 && (
            <>
              {/* White background for visibility */}
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#ffffff"
                strokeWidth={8}
                geodesic={true}
              />
              {/* Blue foreground line */}
              <Polyline
                coordinates={routeCoordinates}
                strokeColor="#3b82f6"
                strokeWidth={4}
                geodesic={true}
              />
            </>
          )}

          {/* Provider marker */}
          {providerLocation && (
            <Marker
              coordinate={providerLocation}
              title="Your Location"
              description="You are here"
            >
              <View className="bg-blue-600 rounded-full p-2 border-4 border-white shadow-lg">
                <Feather name="navigation" size={20} color="white" />
              </View>
            </Marker>
          )}

          {/* Patient marker */}
          {patientLocation && (
            <Marker
              coordinate={patientLocation}
              title={`${patientName}'s Location`}
              description="Patient destination"
            >
              <View className="bg-red-600 rounded-full p-2 border-4 border-white shadow-lg">
                <Feather name="map-pin" size={20} color="white" />
              </View>
            </Marker>
          )}
        </MapView>

        {/* Top info bar */}
        <View style={styles.topBar}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            disabled={isLoading}
          >
            <Feather name="x" size={24} color="#666" />
          </TouchableOpacity>

          <View style={styles.infoSection}>
            {isLoading ? (
              <ActivityIndicator size="small" color="#4F46E5" />
            ) : (
              <>
                <Text style={styles.distanceText}>
                  {distance.toFixed(1)} km away
                </Text>
                <Text style={styles.durationText}>
                  ~{duration} min ETA
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Bottom action bar */}
        <View style={styles.bottomBar}>
          <View style={styles.statusInfo}>
            <Text style={styles.statusLabel}>Heading to {patientName}</Text>
            {isTracking && (
              <View style={styles.trackingIndicator}>
                <View style={styles.trackingDot} />
                <Text style={styles.trackingText}>Tracking active</Text>
              </View>
            )}
          </View>

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
      </View>
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
    paddingTop: 50,
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
  arrivedButton: {
    flexDirection: 'row',
    backgroundColor: '#10b981',
    paddingVertical: 14,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  arrivedButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
});
