import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Speech from "expo-speech";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Image,
    Linking,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import MapViewDirections from "react-native-maps-directions";
import { GOOGLE_MAPS_API_KEY } from "../lib/googleMaps";
import { SafeAreaView } from "react-native-safe-area-context";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import { buildBackendAssetUrl } from "../lib/backend";
import {
  isValidCoordinate,
  normalizeCoordinate,
  type NormalizedCoordinate,
} from "../lib/coordinate";
import { ensureForegroundLocationPermission } from "../lib/locationPermission";
import socketService from "../lib/socket";
import { logViewMountDebug } from "../lib/viewErrorLogger";

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
  ailmentTitle?: string;
  consultationMode?: "house_visit" | "video_consultation";
  createdAt?: string;
}

const { width, height } = Dimensions.get("window");
const ASPECT_RATIO = width / height;
const LATITUDE_DELTA = 0.05;
const LONGITUDE_DELTA = LATITUDE_DELTA * ASPECT_RATIO;

export default function ProviderRouteModal({
  visible,
  onClose,
  requestId,
  providerId,
  patientLocation: rawPatientLocation,
  patientAddress,
  patientName = "Patient",
  providerProfileImage,
  patientProfileImage,
  onCompleteRoute,
  ailmentTitle,
  consultationMode,
  createdAt,
}: ProviderRouteModalProps) {
  const router = useRouter();
  const mapRef = useRef<MapView>(null);
  const routeInitializedRef = useRef(false);
  const locationSubscriptionRef = useRef<any>(null);
  const arrivedRef = useRef(false);
  const lastEmitRef = useRef(0);
  const hasFittedRouteRef = useRef(false);
  const lastSpeechTimeRef = useRef(0);

  const patientLocation = useMemo(
    () => normalizeCoordinate(rawPatientLocation),
    [rawPatientLocation],
  );
  const [providerLocation, setProviderLocation] =
    useState<NormalizedCoordinate | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [routeDistance, setRouteDistance] = useState<number | null>(null);
  const [routeDuration, setRouteDuration] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [, setLastSpeechTime] = useState<number>(0);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!visible) return;

    logViewMountDebug("ProviderRouteModal", "rendering route map", {
      patientLocation,
      providerLocation,
      hasPatientProfileImage: Boolean(patientProfileImage),
      hasProviderProfileImage: Boolean(providerProfileImage),
    });
  }, [
    visible,
    patientLocation,
    providerLocation,
    patientProfileImage,
    providerProfileImage,
  ]);

  // Stop speech when modal closes
  useEffect(() => {
    return () => {
      Speech.stop();
    };
  }, []);

  const speak = (text: string) => {
    Speech.speak(text, {
      language: "en",
      pitch: 1.0,
      rate: 0.9,
    });
  };

  const openExternalMaps = () => {
    if (!isValidCoordinate(patientLocation)) {
      Alert.alert("Error", "Invalid patient location");
      return;
    }

    const scheme = Platform.select({
      ios: "maps:0,0?q=",
      android: "geo:0,0?q=",
    });
    const latLng = `${patientLocation.latitude},${patientLocation.longitude}`;
    const label = patientName;

    const query =
      patientAddress && patientAddress.length > 5
        ? encodeURIComponent(patientAddress)
        : latLng;

    const url = Platform.select({
      ios: `${scheme}${label}@${latLng}`,
      android: `${scheme}${query}(${label})`,
    });

    if (url) {
      Linking.openURL(url);
    }
  };

  const deg2rad = (deg: number) => {
    return deg * (Math.PI / 180);
  };

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ) => {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  };

  const initializeRoute = useCallback(async () => {
    if (!isValidCoordinate(patientLocation)) {
      Alert.alert("Error", "Patient location not available");
      return;
    }

    setIsLoading(true);
    try {
      console.log("📍 Getting provider current location...");
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const providerCoords = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };

      // ✅ Validate before setting
      if (!isValidCoordinate(providerCoords)) {
        throw new Error("Invalid provider location");
      }

      setProviderLocation(providerCoords);

      if (mapRef.current) {
        setTimeout(() => {
          const points = [providerCoords, patientLocation];
          mapRef.current?.fitToCoordinates(points, {
            edgePadding: {
              top: 120,
              right: 50,
              bottom: Math.round(height * 0.34),
              left: 50,
            },
            animated: true,
          });
        }, 500);
      }
    } catch (error) {
      console.error("Error initializing route:", error);
      Alert.alert("Error", "Failed to initialize route. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [patientLocation]);

  const startTracking = useCallback(async () => {
    try {
      console.log("🚗 Starting real-time location tracking...");
      setIsTracking(true);

      const { granted } = await ensureForegroundLocationPermission({
        requestIfNeeded: true,
      });
      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Location permission is required for route tracking",
        );
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
            console.warn("⚠️ Invalid location update received");
            return;
          }

          setProviderLocation(newProviderLocation);
          const now = Date.now();
          // Emit at most once every 10 seconds
          if (now - lastEmitRef.current > 10000) {
            socketService.updateProviderLocation(
              requestId,
              providerId,
              newProviderLocation,
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
                patientLocation.longitude,
              );

              // Speech logic - only speak once per minute
              const currentTime = Date.now();
              const oneMinuteInMs = 60 * 1000; // 60 seconds in milliseconds
              const timeSinceLastSpeech =
                currentTime - lastSpeechTimeRef.current;

              // Only speak arrival once (guard with ref) - always announce arrival
              if (distToDest < 0.1 && !arrivedRef.current) {
                arrivedRef.current = true;
                speak("You have arrived at the destination.");
                lastSpeechTimeRef.current = currentTime;
                setLastSpeechTime(currentTime);
              } else if (
                distToDest >= 0.1 &&
                timeSinceLastSpeech >= oneMinuteInMs
              ) {
                // Only speak distance updates if at least 1 minute has passed
                const eta = Math.round((distToDest / 40) * 60);
                speak(
                  `You are ${distToDest.toFixed(1)} kilometers away. About ${eta} minutes remaining.`,
                );
                lastSpeechTimeRef.current = currentTime;
                setLastSpeechTime(currentTime);
              }
            } catch (error) {
              console.error("Error calculating distance:", error);
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
        },
      );

      console.log("✅ Location tracking started");
    } catch (error) {
      console.error("Error starting location tracking:", error);
      Alert.alert("Error", "Failed to start location tracking");
      setIsTracking(false);
    }
  }, [requestId, providerId, patientLocation]);

  const stopTracking = useCallback(() => {
    if (locationSubscriptionRef.current) {
      locationSubscriptionRef.current.remove();
      locationSubscriptionRef.current = null;
    }
    setIsTracking(false);
    console.log("🛑 Location tracking stopped");
  }, []);

  const handleArrived = useCallback(async () => {
    try {
      stopTracking();

      console.log("✅ Marking provider as arrived");
      if (!isValidCoordinate(providerLocation)) {
        Alert.alert("Error", "Current location not available");
        return;
      }

      if (!requestId) {
        console.error("Error: requestId is missing");
        Alert.alert("Error", "Request ID is missing");
        return;
      }

      console.log(
        "📤 Updating request status to arrived with location:",
        providerLocation,
      );
      await socketService.updateRequestStatus(
        requestId,
        providerId,
        "arrived",
        providerLocation,
      );

      Alert.alert(
        "Success",
        "You've arrived at the patient's location!",
        [
          {
            text: "OK",
            onPress: () => {
              // Navigate to requests screen after user acknowledges
              router.push("/(app)/(provider)/requests");
            },
          },
        ],
      );

      if (onCompleteRoute) {
        onCompleteRoute();
      }

      onClose();
    } catch (error: any) {
      console.error("Error marking as arrived:", error);
      Alert.alert("Error", error.message || "Failed to mark as arrived");
    }
  }, [requestId, providerLocation, onClose, onCompleteRoute, stopTracking, router]);

  const handleCancel = useCallback(async () => {
    setIsCancelling(true);
    try {
      stopTracking();

      Alert.alert(
        "Cancel Request",
        "Are you sure you want to cancel this request? The patient will be notified.",
        [
          {
            text: "Keep Request",
            onPress: () => {
              setIsCancelling(false);
              startTracking();
            },
            style: "cancel",
          },
          {
            text: "Cancel Request",
            onPress: async () => {
              try {
                console.log("📤 Cancelling request...");
                await socketService.cancelRequest(
                  requestId,
                  "provider",
                  "Provider cancelled the request",
                );
                Alert.alert("Cancelled", "Request has been cancelled");
                onClose();
              } catch (error: any) {
                console.error("Error cancelling request:", error);
                Alert.alert(
                  "Error",
                  error.message || "Failed to cancel request",
                );
                setIsCancelling(false);
                startTracking();
              }
            },
            style: "destructive",
          },
        ],
      );
    } catch (error) {
      console.error("Error in handleCancel:", error);
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

  if (!isValidCoordinate(patientLocation)) {
    return (
      <Modal visible={visible} animationType="slide" transparent={false}>
        <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
          <View style={styles.errorContainer}>
            <View style={styles.errorIconWrap}>
              <Feather name="map-pin" size={32} color={AUTH_COLORS.green} />
            </View>
            <Text style={styles.errorTitle}>Location unavailable</Text>
            <Text style={styles.errorText}>
              We couldn&apos;t load the patient&apos;s location for navigation.
              Please close and try again from your requests list.
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
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
      <View style={styles.container}>
        <MapView
          onLayout={(event) => {
            logViewMountDebug("ProviderRouteModal", "MapView layout", {
              layout: event.nativeEvent.layout,
              initialRegion,
            });
          }}
          onMapReady={() => {
            logViewMountDebug("ProviderRouteModal", "MapView ready", {
              initialRegion,
            });
            setMapReady(true);
          }}
          ref={mapRef}
          style={styles.map}
          provider={PROVIDER_GOOGLE}
          showsUserLocation
          followsUserLocation={false}
          showsMyLocationButton
          initialRegion={initialRegion}
        >
          {/* ✅ Only render marker if coordinate is valid */}
          {isValidCoordinate(providerLocation) && (
            <Marker
              coordinate={providerLocation}
              title="Your Location"
              description="You are here"
              identifier="provider"
              tracksViewChanges={false}
            >
              <View
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: 25,
                  borderWidth: 4,
                  borderColor: "#FFFFFF",
                  backgroundColor: AUTH_COLORS.green,
                  overflow: "hidden",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                  justifyContent: "center",
                  alignItems: "center",
                }}
              >
                {providerProfileImage ? (
                  <Image
                    source={{
                      uri:
                        buildBackendAssetUrl("images", providerProfileImage) ||
                        undefined,
                    }}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                    onError={(error) => {
                      console.log(
                        "Failed to load provider profile image:",
                        error,
                      );
                    }}
                  />
                ) : (
                  <Feather name="navigation" size={24} color="white" />
                )}
              </View>
            </Marker>
          )}

          {/* ✅ Route directions using MapViewDirections - Shows the road route provider needs to travel */}
          {providerLocation &&
            isValidCoordinate(providerLocation) &&
            isValidCoordinate(patientLocation) && (
              <MapViewDirections
                origin={{
                  latitude: providerLocation.latitude,
                  longitude: providerLocation.longitude,
                }}
                destination={{
                  latitude: patientLocation.latitude,
                  longitude: patientLocation.longitude,
                }}
                apikey={GOOGLE_MAPS_API_KEY}
                strokeWidth={5}
                strokeColor={AUTH_COLORS.green}
                mode="DRIVING"
                optimizeWaypoints={true}
                onReady={(result) => {
                  // Store route details for display
                  setRouteDistance(result.distance);
                  setRouteDuration(result.duration);

                  // Update distance with actual route distance
                  if (result.distance) {
                    setDistance(result.distance);
                  }

                  // Fit map to show the entire route
                  if (mapRef.current) {
                    mapRef.current.fitToCoordinates(
                      [
                        {
                          latitude: providerLocation.latitude,
                          longitude: providerLocation.longitude,
                        },
                        {
                          latitude: patientLocation.latitude,
                          longitude: patientLocation.longitude,
                        },
                      ],
                      {
                        edgePadding: {
                          top: 120,
                          right: 50,
                          bottom: Math.round(height * 0.34),
                          left: 50,
                        },
                        animated: true,
                      },
                    );
                  }
                  console.log(`Route Distance: ${result.distance} km`);
                  console.log(`Route Duration: ${result.duration} minutes`);
                }}
                onError={(errorMessage) => {
                  console.log("MapViewDirections Error:", errorMessage);
                  // Fallback to straight line distance if route fails
                }}
              />
            )}

          {/* ✅ Patient marker - already validated above */}
          <Marker
            coordinate={patientLocation}
            title={`${patientName}'s Location`}
            description="Patient destination"
            identifier="patient"
            tracksViewChanges={false}
          >
            <View
              style={{
                width: 50,
                height: 50,
                borderRadius: 25,
                borderWidth: 4,
                borderColor: "#FFFFFF",
                backgroundColor: "#EF4444",
                overflow: "hidden",
                shadowColor: "#000",
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              {patientProfileImage ? (
                <Image
                  source={{
                    uri:
                      buildBackendAssetUrl("images", patientProfileImage) ||
                      undefined,
                  }}
                  style={{ width: "100%", height: "100%" }}
                  resizeMode="cover"
                  onError={(error) => {
                    console.log("Failed to load patient profile image:", error);
                  }}
                />
              ) : (
                <Feather name="map-pin" size={24} color="white" />
              )}
            </View>
          </Marker>
        </MapView>

        <SafeAreaView style={styles.topBar} edges={["top"]} pointerEvents="box-none">
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            disabled={isLoading || isCancelling}
          >
            <Feather name="x" size={22} color={AUTH_COLORS.textDark} />
          </TouchableOpacity>

          <View style={styles.infoSection}>
            {isLoading ? (
              <ActivityIndicator size="small" color={AUTH_COLORS.green} />
            ) : (
              <>
                <Text style={styles.distanceText}>
                  {routeDistance !== null
                    ? routeDistance.toFixed(1)
                    : distance.toFixed(1)}{" "}
                  km away
                </Text>
                <Text style={styles.durationText}>
                  ~
                  {routeDuration !== null
                    ? Math.round(routeDuration)
                    : duration}{" "}
                  min ETA
                </Text>
              </>
            )}
          </View>
        </SafeAreaView>

        <SafeAreaView style={styles.bottomSheetWrap} edges={["bottom"]} pointerEvents="box-none">
          <View style={styles.bottomBar}>
            <View style={styles.sheetHandle} />

            <ScrollView
              style={styles.bottomScroll}
              contentContainerStyle={styles.bottomScrollContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <View style={styles.statusInfo}>
                <Text style={styles.statusLabel}>
                  Navigating to {patientName}
                </Text>
                {routeDistance !== null && routeDuration !== null ? (
                  <View style={styles.routeInfoContainer}>
                    <View style={styles.routeInfoRow}>
                      <Feather name="map" size={14} color={AUTH_COLORS.green} />
                      <Text style={styles.routeInfoLabel}>Distance</Text>
                      <Text style={styles.routeInfoValue}>
                        {routeDistance.toFixed(1)} km
                      </Text>
                    </View>
                    <View style={styles.routeInfoRow}>
                      <Feather name="clock" size={14} color={AUTH_COLORS.green} />
                      <Text style={styles.routeInfoLabel}>Duration</Text>
                      <Text style={styles.routeInfoValue}>
                        {Math.round(routeDuration)} min
                      </Text>
                    </View>
                  </View>
                ) : null}
                {isTracking ? (
                  <View style={styles.trackingIndicator}>
                    <View style={styles.trackingDot} />
                    <Text style={styles.trackingText}>Live tracking active</Text>
                  </View>
                ) : null}
              </View>

              <View style={styles.requestDetailsCard}>
                <Text style={styles.requestTitle}>
                  {ailmentTitle || "Healthcare Request"}
                </Text>

                {consultationMode ? (
                  <View
                    style={[
                      styles.modeChip,
                      consultationMode === "video_consultation"
                        ? styles.modeChipVideo
                        : styles.modeChipHouse,
                    ]}
                  >
                    <Feather
                      name={
                        consultationMode === "video_consultation"
                          ? "video"
                          : "home"
                      }
                      size={13}
                      color={
                        consultationMode === "video_consultation"
                          ? "#1D4ED8"
                          : AUTH_COLORS.greenDark
                      }
                    />
                    <Text
                      style={[
                        styles.modeChipText,
                        consultationMode === "video_consultation"
                          ? styles.modeChipTextVideo
                          : styles.modeChipTextHouse,
                      ]}
                    >
                      {consultationMode === "video_consultation"
                        ? "Video Consultation"
                        : "House Visit"}
                    </Text>
                  </View>
                ) : null}

                <View style={styles.metaCard}>
                  {patientAddress ? (
                    <View style={styles.metaRow}>
                      <Feather name="map-pin" size={14} color={AUTH_COLORS.green} />
                      <Text style={styles.metaText} numberOfLines={2}>
                        {patientAddress}
                      </Text>
                    </View>
                  ) : null}
                  {createdAt ? (
                    <View style={styles.metaRow}>
                      <Feather name="calendar" size={14} color={AUTH_COLORS.green} />
                      <Text style={styles.metaText}>
                        Requested: {new Date(createdAt).toLocaleString()}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>

              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={[
                    styles.cancelButton,
                    isCancelling && styles.disabledButton,
                  ]}
                  onPress={handleCancel}
                  disabled={isLoading || isCancelling}
                >
                  <Feather name="x-circle" size={18} color={AUTH_COLORS.error} />
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.primaryButton, isLoading && styles.disabledButton]}
                  onPress={handleArrived}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="check-circle" size={18} color="#fff" />
                      <Text style={styles.primaryButtonText}>Mark as Arrived</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={styles.externalMapButton}
                onPress={openExternalMaps}
              >
                <Feather name="external-link" size={18} color={AUTH_COLORS.green} />
                <Text style={styles.externalMapButtonText}>
                  Open in Google Maps
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AUTH_COLORS.bg,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
    gap: 12,
  },
  closeButton: {
    width: 42,
    height: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 21,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  infoSection: {
    flex: 1,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  distanceText: {
    fontSize: 16,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  durationText: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
  },
  bottomSheetWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10,
  },
  bottomBar: {
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderBottomWidth: 0,
    maxHeight: height * 0.48,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: AUTH_COLORS.green,
    marginTop: 10,
    marginBottom: 6,
  },
  bottomScroll: {
    flexGrow: 0,
  },
  bottomScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  routeInfoContainer: {
    marginTop: 8,
    padding: 10,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    gap: 6,
  },
  routeInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  routeInfoLabel: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    flex: 1,
  },
  routeInfoValue: {
    fontSize: 12,
    color: AUTH_COLORS.greenDark,
    fontWeight: "700",
  },
  statusInfo: {
    marginBottom: 12,
  },
  statusLabel: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 4,
  },
  trackingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 8,
  },
  trackingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: AUTH_COLORS.green,
  },
  trackingText: {
    fontSize: 12,
    color: AUTH_COLORS.greenDark,
    fontWeight: "600",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  cancelButton: {
    flexDirection: "row",
    backgroundColor: "#FEF2F2",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    flex: 0.38,
    borderWidth: 2,
    borderColor: "#FECACA",
  },
  cancelButtonText: {
    color: AUTH_COLORS.error,
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButton: {
    flexDirection: "row",
    backgroundColor: AUTH_COLORS.green,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    flex: 0.62,
  },
  primaryButtonText: {
    color: AUTH_COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
  externalMapButton: {
    flexDirection: "row",
    backgroundColor: AUTH_COLORS.white,
    paddingVertical: 13,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
  },
  externalMapButtonText: {
    color: AUTH_COLORS.greenDark,
    fontSize: 14,
    fontWeight: "700",
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 28,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    marginBottom: 8,
    textAlign: "center",
  },
  errorText: {
    fontSize: 15,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },
  requestDetailsCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
  },
  requestTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    marginBottom: 10,
  },
  modeChip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignSelf: "flex-start",
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  modeChipHouse: {
    backgroundColor: AUTH_COLORS.greenSoft,
    borderColor: AUTH_COLORS.inputBorder,
  },
  modeChipVideo: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: "700",
  },
  modeChipTextHouse: {
    color: AUTH_COLORS.greenDark,
  },
  modeChipTextVideo: {
    color: "#1D4ED8",
  },
  metaCard: {
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  metaText: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    flex: 1,
    lineHeight: 18,
  },
});
