// app/(provider)/home.tsx

import { normalizeCoordinateOrUndefined } from "@/lib/coordinate";
import { calculateDistance } from "@/lib/distance";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../../context/AuthContext";
import { useRoute } from "../../../context/RouteContext";
import apiClient from "../../../lib/api";
import socketService from "../../../lib/socket";
import { logViewMountDebug } from "../../../lib/viewErrorLogger";

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
};

export default function ProviderHome() {
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(0);
  const { user, updateUser } = useAuth();
  const router = useRouter();

  // Online/Offline toggle - provider can manually toggle, but only if verified
  const [isOnline, setIsOnline] = useState(false);
  const providerOnlineStorageKey = user?.userId
    ? `provider-online-state-${user.userId}`
    : null;

  const toggleOnline = () => {
    if (!user?.isDocumentVerified) {
      Alert.alert(
        "Account Not Verified",
        "You need to be verified before you can go online. Please wait for admin approval.",
        [{ text: "OK" }],
      );
      return;
    }
    setIsOnline((prev) => !prev);
  };

  // Load persisted online/offline state for this provider
  useEffect(() => {
    const loadPersistedOnlineState = async () => {
      if (!providerOnlineStorageKey) return;
      try {
        const stored = await AsyncStorage.getItem(providerOnlineStorageKey);
        const parsed = stored === "true";

        // If verification is missing, always force offline
        if (!user?.isDocumentVerified) {
          setIsOnline(false);
          await AsyncStorage.setItem(providerOnlineStorageKey, "false");
          return;
        }

        setIsOnline(parsed);
      } catch (error) {
        console.error("Error loading provider online state:", error);
      }
    };

    loadPersistedOnlineState();
  }, [providerOnlineStorageKey, user?.isDocumentVerified]);

  // Persist online/offline state whenever it changes
  useEffect(() => {
    const persistOnlineState = async () => {
      if (!providerOnlineStorageKey) return;
      try {
        await AsyncStorage.setItem(
          providerOnlineStorageKey,
          String(isOnline && !!user?.isDocumentVerified),
        );
      } catch (error) {
        console.error("Error persisting provider online state:", error);
      }
    };
    persistOnlineState();
  }, [isOnline, providerOnlineStorageKey, user?.isDocumentVerified]);

  const [selectedRequest, setSelectedRequest] = useState<null | any>(null);
  const [providerLocation, setProviderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const latestProviderLocationRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const lastRequestsRefreshByLocationRef = useRef<{
    latitude: number;
    longitude: number;
    timestamp: number;
  } | null>(null);
  const socketListenersSetupRef = useRef(false);
  const socketConnectedRef = useRef(false);
  const socketListenersCleanupRef = useRef<(() => void) | null>(null);
  const socketHandlersRef = useRef<{
    handleNewRequest?: (request: any) => void;
    handleRequestStatusChanged?: (data: any) => void;
    handleRequestUpdated?: (data: any) => void;
    handleRequestHidden?: (data: any) => void;
  }>({});
  const { startRoute } = useRoute();
  const LOCATION_REFRESH_MIN_INTERVAL_MS = 30000;
  const LOCATION_REFRESH_MIN_DISTANCE_METERS = 100;

  const getDistanceMeters = useCallback(
    (
      pointA: { latitude: number; longitude: number },
      pointB: { latitude: number; longitude: number },
    ) => {
      const toRad = (value: number) => (value * Math.PI) / 180;
      const earthRadiusInMeters = 6371000;
      const dLat = toRad(pointB.latitude - pointA.latitude);
      const dLon = toRad(pointB.longitude - pointA.longitude);
      const lat1 = toRad(pointA.latitude);
      const lat2 = toRad(pointB.latitude);
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
          Math.cos(lat2) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return earthRadiusInMeters * c;
    },
    [],
  );

  useEffect(() => {
    latestProviderLocationRef.current = providerLocation;
  }, [providerLocation]);

  const onboardingSteps: {
    id: number;
    title: string;
    description: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    image?: boolean;
  }[] = [
    {
      id: 1,
      title: "Welcome to HealthConnect",
      description:
        "Receive nearby patient requests and provide care where it's needed most.",
      icon: "briefcase",
      image: true,
    },
    {
      id: 2,
      title: "Go Online to Receive Requests",
      description:
        "Use the online switch to start receiving consultation requests in your area.",
      icon: "toggle-switch",
    },
    {
      id: 3,
      title: "Review Request Details",
      description:
        "View the patient's ailment, estimated cost and location before accepting.",
      icon: "file-document-outline",
    },
    {
      id: 4,
      title: "Track Your Earnings",
      description:
        "Keep an eye on your current month earnings and completed consultations.",
      icon: "wallet-outline",
    },
  ];

  // First-time user welcome modal (provider)
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const seen = await AsyncStorage.getItem("provider-onboarding-shown-v1");
        if (!seen) {
          setShowWelcomeModal(true);
        }
      } catch (e) {
        console.error("Error checking provider onboarding flag:", e);
      }
    };

    checkFirstTime();
  }, []);

  const handleWelcomeModalClose = async () => {
    try {
      await AsyncStorage.setItem("provider-onboarding-shown-v1", "true");
    } catch (e) {
      console.error("Error saving provider onboarding flag:", e);
    }
    setShowWelcomeModal(false);
  };

  const handleOnboardingNext = () => {
    if (currentOnboardingStep < onboardingSteps.length - 1) {
      setCurrentOnboardingStep((step) => step + 1);
    } else {
      handleWelcomeModalClose();
    }
  };

  const handleOnboardingPrevious = () => {
    if (currentOnboardingStep > 0) {
      setCurrentOnboardingStep((step) => step - 1);
    }
  };

  const handleOnboardingSkip = () => {
    handleWelcomeModalClose();
  };

  // Load current month's earnings for this provider
  const loadMonthlyEarnings = useCallback(async () => {
    try {
      const response = await apiClient.get("/app/transaction/earnings");
      const earnings = response.data?.currentMonthEarnings ?? 0;
      setMonthlyEarnings(earnings);
    } catch (error) {
      console.error("Error loading monthly earnings:", error);
      // Fail silently; keep last known value or 0
    }
  }, []);

  // Helper function to fetch and update user details
  const fetchAndUpdateUserDetails = useCallback(async () => {
    if (!user?.userId) return;
    try {
      console.log("🔄 Fetching latest user details...");
      const userResponse = await apiClient.get("/app/auth/user-details/");
      console.log("User Details Response:", userResponse.data);
      if (userResponse.data?.status && userResponse.data?.user) {
        updateUser(userResponse.data.user);
        console.log(
          "✅ User details updated, isDocumentVerified:",
          userResponse.data.user.isDocumentVerified,
        );
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  }, []);

  // Use ref to prevent multiple simultaneous loads
  const isLoadingRequestsRef = useRef(false);

  // Define loadAvailableRequests before using it in useEffect
  const loadAvailableRequests = useCallback(async () => {
    if (!user?.userId) {
      console.log("⚠️ No userId, skipping request load");
      return;
    }

    // Prevent multiple simultaneous loads
    if (isLoadingRequestsRef.current) {
      console.log("⚠️ Request load already in progress, skipping");
      return;
    }

    console.log(
      "📥 Starting to load available requests for provider:",
      user.userId,
    );

    isLoadingRequestsRef.current = true;

    try {
      setIsLoadingRequests(true);

      // Wait for socket to be ready
      console.log("⏳ Waiting for socket to connect...");
      await socketService.waitForConnection(10000);

      console.log("📡 Socket is ready, fetching requests");
      const currentProviderLocation = latestProviderLocationRef.current;
      const availableRequests = await socketService.getAvailableRequests(
        user.userId,
        currentProviderLocation,
      );
      console.log("✅ Available requests received:", availableRequests);
      setRequests(Array.isArray(availableRequests) ? availableRequests : []);
    } catch (error: any) {
      console.error("❌ Error loading requests:", error);
      // Don't show alert on initial load, just log
      if (requests.length === 0) {
        console.warn("Failed to load requests, will retry on next focus");
      } else {
        Alert.alert(
          "Error",
          "Failed to load available requests: " + error.message,
        );
      }
    } finally {
      setIsLoadingRequests(false);
      isLoadingRequestsRef.current = false;
      console.log("✅ Loading complete, isLoadingRequests set to false");
    }
  }, [user?.userId]);

  // Connect socket and fetch available requests only when online
  useEffect(() => {
    if (user?.userId && isOnline) {
      // Only connect if not already connected for this online session
      const socket = socketService.getSocket();
      if (!socket?.connected) {
        console.log("🔌 Connecting socket for provider:", user.userId);
        // Default to doctor role, but should ideally use user.role if available
        socketService.connect(user.userId, (user.role as any) || "doctor");
      } else {
        console.log("✅ Socket already connected, reusing existing connection");
      }

      const currentSocket = socketService.getSocket();
      console.log("📡 Socket state:", currentSocket?.connected);

      // Only set up connect handler if we haven't already handled it for this online session
      if (!socketConnectedRef.current) {
        // Listen for connect event - only load once per online toggle
        const handleConnect = () => {
          if (socketConnectedRef.current || !isOnline) {
            console.log(
              "⚠️ Already handled connect event or went offline, skipping",
            );
            return;
          }
          socketConnectedRef.current = true;
          console.log("✅ Socket connected event fired, loading requests...");
          // Small delay to ensure socket is fully ready
          setTimeout(() => {
            if (!isLoadingRequestsRef.current && isOnline) {
              loadAvailableRequests();
            }
          }, 500);
        };

        // If already connected, load requests immediately
        if (currentSocket?.connected) {
          socketConnectedRef.current = true;
          console.log("✅ Socket already connected, loading requests...");
          setTimeout(() => {
            if (!isLoadingRequestsRef.current && isOnline) {
              loadAvailableRequests();
            }
          }, 500);
        } else {
          console.log(
            "⏳ Socket not yet connected, waiting for connect event...",
          );
          currentSocket?.once("connect", handleConnect);
        }

        return () => {
          currentSocket?.off("connect", handleConnect);
          // Don't reset socketConnectedRef here - let it reset when going offline
        };
      }
    } else if (!isOnline) {
      // Clean up when going offline
      console.log("📴 Provider went offline, cleaning up socket listeners");
      setRequests([]);
      isLoadingRequestsRef.current = false;
      socketConnectedRef.current = false;

      // Clean up socket listeners if they were set up
      if (socketListenersCleanupRef.current) {
        console.log("🧹 Executing socket listeners cleanup on offline");
        try {
          socketListenersCleanupRef.current();
        } catch (error) {
          console.error("Error during socket listeners cleanup:", error);
        }
        socketListenersCleanupRef.current = null;
      }
      socketListenersSetupRef.current = false;
      socketHandlersRef.current = {};
    }
    // Remove loadAvailableRequests from dependencies to prevent loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.role, isOnline]);

  // Watch provider location while online and refresh available requests with throttling.
  useEffect(() => {
    let active = true;

    const stopLocationWatch = () => {
      if (locationWatcherRef.current) {
        locationWatcherRef.current.remove();
        locationWatcherRef.current = null;
      }
    };

    const startLocationTracking = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          console.warn("Location permission not granted for provider map");

          Alert.alert(
            "Location Permission Required",
            "HealthConnect needs access to your location so we can show nearby patient requests. Please enable location in your device settings.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => {
                  try {
                    // Open the OS settings page for this app
                    Linking.openSettings();
                  } catch (err) {
                    console.error("Failed to open app settings:", err);
                  }
                },
              },
            ],
          );
          return;
        }

        const initialLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });

        if (!active) return;

        const initialCoords = {
          latitude: initialLocation.coords.latitude,
          longitude: initialLocation.coords.longitude,
        };

        setProviderLocation(initialCoords);
        lastRequestsRefreshByLocationRef.current = {
          ...initialCoords,
          timestamp: Date.now(),
        };

        // Force one refresh after acquiring initial coordinates for online mode.
        if (isOnline && !isLoadingRequestsRef.current) {
          await loadAvailableRequests();
        }

        stopLocationWatch();
        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 50,
          },
          async (position) => {
            if (!active || !isOnline) return;

            const nextCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            setProviderLocation(nextCoords);

            const lastRefresh = lastRequestsRefreshByLocationRef.current;
            if (!lastRefresh) {
              lastRequestsRefreshByLocationRef.current = {
                ...nextCoords,
                timestamp: Date.now(),
              };
              return;
            }

            const movedMeters = getDistanceMeters(lastRefresh, nextCoords);
            const elapsedMs = Date.now() - lastRefresh.timestamp;
            const canRefreshByLocation =
              movedMeters >= LOCATION_REFRESH_MIN_DISTANCE_METERS &&
              elapsedMs >= LOCATION_REFRESH_MIN_INTERVAL_MS;

            if (canRefreshByLocation && !isLoadingRequestsRef.current) {
              lastRequestsRefreshByLocationRef.current = {
                ...nextCoords,
                timestamp: Date.now(),
              };
              await loadAvailableRequests();
            }
          },
        );
      } catch (e) {
        console.error("Error tracking provider location:", e);
        Alert.alert(
          "Location Error",
          "We could not get your current location. Please check that location services are enabled and try again.",
        );
      }
    };

    if (isOnline) {
      startLocationTracking();
    } else {
      stopLocationWatch();
      lastRequestsRefreshByLocationRef.current = null;
    }

    return () => {
      active = false;
      stopLocationWatch();
    };
  }, [getDistanceMeters, isOnline, loadAvailableRequests]);

  // Automatically set provider offline if document verification is lost
  useEffect(() => {
    if (user?.isDocumentVerified === false && isOnline) {
      console.log("⚠️ Document verification lost, automatically setting provider offline");
      setIsOnline(false);
      Alert.alert(
        "Account Verification Required",
        "Your account verification status has changed. You have been automatically set to offline. Please wait for admin approval before going online again.",
        [{ text: "OK" }],
      );
    }
  }, [user?.isDocumentVerified, isOnline]);

  // Refresh user details and requests when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      console.log("🔄 ProviderHome came into focus");

      // Fetch user details and earnings
      fetchAndUpdateUserDetails();
      loadMonthlyEarnings();

      // If online, refresh requests to get latest state (only if not already loading)
      if (isOnline && user?.userId && !isLoadingRequestsRef.current) {
        console.log("🔄 Provider is online, refreshing requests on focus");
        const socket = socketService.getSocket();
        if (socket?.connected) {
          // Small delay to ensure socket is ready
          setTimeout(() => {
            if (!isLoadingRequestsRef.current) {
              loadAvailableRequests();
            }
          }, 300);
        } else {
          console.warn(
            "⚠️ Socket not connected on focus, will wait for connection",
          );
        }
      }
    }, [
      fetchAndUpdateUserDetails,
      loadMonthlyEarnings,
      isOnline,
      user?.userId,
    ]),
  );

  // Universal refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh user details first
      await fetchAndUpdateUserDetails();
      // Then refresh earnings
      await loadMonthlyEarnings();
      // Then refresh requests if online (only if not already loading)
      if (isOnline && !isLoadingRequestsRef.current) {
        await loadAvailableRequests();
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [fetchAndUpdateUserDetails, loadMonthlyEarnings, isOnline]);

  // Listen for real-time socket events - set up once when online, clean up when offline
  useEffect(() => {
    if (!isOnline || !user?.userId) {
      return; // Cleanup is handled in the socket connection useEffect when going offline
    }

    // Prevent setting up listeners multiple times for the same online session
    if (socketListenersSetupRef.current) {
      console.log(
        "⚠️ Socket listeners already set up for this online session, skipping",
      );
      return;
    }

    const socket = socketService.getSocket();
    if (!socket?.connected) {
      console.warn(
        "⚠️ Socket not connected, will set up listeners when connected",
      );
      // Wait for socket to connect - use once to prevent multiple setups
      const checkConnection = () => {
        const currentSocket = socketService.getSocket();
        if (
          currentSocket?.connected &&
          !socketListenersSetupRef.current &&
          isOnline
        ) {
          setupListeners(currentSocket);
        }
      };
      socket?.once("connect", checkConnection);
      return () => {
        socket?.off("connect", checkConnection);
      };
    }

    // Set up listeners immediately if socket is connected
    setupListeners(socket);

    function setupListeners(socketInstance: any) {
      if (socketListenersSetupRef.current) {
        console.log("⚠️ Listeners already set up, skipping duplicate setup");
        return;
      }

      socketListenersSetupRef.current = true;
      console.log(
        "🔔 Setting up real-time socket listeners for provider (ONLINE mode)",
      );

      // Handle new requests coming in real-time
      const handleNewRequest = (request: any) => {
        if (!isOnline) return; // Ignore if went offline
        console.log("✅ New request received in real-time:", request);
        setRequests((prev) => {
          // Check if request already exists to avoid duplicates
          const exists = prev.some((req) => req._id === request._id);
          if (exists) {
            console.log("⚠️ Request already exists, skipping duplicate");
            return prev;
          }
          return [request, ...prev];
        });
      };

      // Handle request status changes (e.g., accepted by another provider, cancelled)
      const handleRequestStatusChanged = (data: any) => {
        if (!isOnline) return; // Ignore if went offline
        console.log("🔄 Request status changed:", data);
        if (data.requestId) {
          setRequests((prev) =>
            prev.filter((req) => req._id !== data.requestId),
          );
        }
      };

      // Handle request updates (when request is accepted/rejected/cancelled)
      const handleRequestUpdated = (data: any) => {
        if (!isOnline) return; // Ignore if went offline
        console.log("📝 Request updated:", data);
        if (data._id) {
          // Remove the request from available list if it's been accepted or cancelled
          if (
            data.status === "accepted" ||
            data.status === "payment_pending" ||
            data.status === "cancelled" ||
            data.status === "completed"
          ) {
            setRequests((prev) => prev.filter((req) => req._id !== data._id));
          }
        }
      };

      // Handle request hidden (when rejected)
      const handleRequestHidden = (data: any) => {
        if (!isOnline) return; // Ignore if went offline
        console.log("👁️ Request hidden:", data);
        if (data.requestId) {
          setRequests((prev) =>
            prev.filter((req) => req._id !== data.requestId),
          );
        }
      };

      // Store handlers in ref for cleanup
      socketHandlersRef.current = {
        handleNewRequest,
        handleRequestStatusChanged,
        handleRequestUpdated,
        handleRequestHidden,
      };

      // Register all listeners - use socketService methods for proper tracking
      socketService.onNewRequestAvailable(handleNewRequest);
      socketService.onRequestStatusChanged(handleRequestStatusChanged);
      socketService.onRequestUpdated(handleRequestUpdated);
      socketInstance.on("requestHidden", handleRequestHidden);

      // Create and store cleanup function
      const cleanup = () => {
        console.log("🧹 Cleaning up real-time socket listeners (OFFLINE mode)");
        const handlers = socketHandlersRef.current;
        if (handlers.handleNewRequest) {
          socketService.off("newRequestAvailable", handlers.handleNewRequest);
        }
        if (handlers.handleRequestStatusChanged) {
          socketService.off(
            "requestStatusChanged",
            handlers.handleRequestStatusChanged,
          );
        }
        if (handlers.handleRequestUpdated) {
          socketService.off("requestUpdated", handlers.handleRequestUpdated);
        }
        if (handlers.handleRequestHidden) {
          socketInstance.off("requestHidden", handlers.handleRequestHidden);
        }
        socketListenersSetupRef.current = false;
        socketHandlersRef.current = {};
      };

      socketListenersCleanupRef.current = cleanup;
    }

    // Return cleanup function for this effect
    return () => {
      // Cleanup listeners when effect unmounts or isOnline changes to false
      if (socketListenersCleanupRef.current) {
        console.log("🧹 Cleaning up socket listeners from effect cleanup");
        try {
          socketListenersCleanupRef.current();
        } catch (error) {
          console.error("Error during socket listeners cleanup:", error);
        }
        socketListenersCleanupRef.current = null;
        socketListenersSetupRef.current = false;
        socketHandlersRef.current = {};
      }
    };
  }, [isOnline, user?.userId]);

  // Route modal handling moved to GlobalRouteModal via RouteContext.
  // Route arrival/cancel handlers moved to GlobalRouteModal via RouteContext.

  const handleAccept = async (request: any) => {
    // Double check user is available
    if (!user || !user.userId) {
      console.error("Cannot accept request: user is not available");
      Alert.alert("Error", "User session not available. Please try again.");
      return;
    }

    // Check if provider is verified before allowing acceptance
    if (!user.isDocumentVerified) {
      Alert.alert(
        "Account Not Verified",
        "Your account is still under review. You cannot accept consultations until your documents have been verified by our admin team. We'll notify you once verification is complete.",
        [{ text: "OK" }],
      );
      return;
    }

    // Check if provider is online
    if (!isOnline) {
      Alert.alert(
        "You are Offline",
        "Please go online to accept consultation requests.",
        [{ text: "OK" }],
      );
      return;
    }

    const currentUserId = user.userId; // Store userId to avoid issues if user becomes null

    try {
      // 1) Accept on backend (assign provider)
      await socketService.acceptRequest(
        request._id,
        currentUserId,
        latestProviderLocationRef.current,
      );

      if (request.consultationMode === "video_consultation") {
        setSelectedRequest(null);
        setRequests((prev) => prev.filter((req) => req._id !== request._id));
        Alert.alert(
          "Teleconsultation Accepted",
          "The patient now needs to complete payment before the consultation can continue.",
        );
        return;
      }

      // 2) Open global route modal immediately for fast UX
      startRoute(request);
      setSelectedRequest(null);

      // 3) In background, request location and send en_route with coords (backend requires location)
      (async () => {
        try {
          // Re-check user in case it changed
          if (!user || !user.userId) {
            console.warn("User not available in background task");
            return;
          }

          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== "granted") {
            console.warn(
              "Location permission not granted; cannot send en_route with coordinates",
            );
            return;
          }

          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          const providerCoords = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };

          await socketService.updateRequestStatus(
            request._id,
            currentUserId,
            "en_route",
            providerCoords,
          );
          console.log("✅ Sent en_route with provider coordinates");
        } catch (bgError: any) {
          console.warn(
            "Failed to send en_route with coords:",
            bgError?.message || bgError,
          );
        }
      })();

      // 4) Remove request locally from home list (real-time update)
      setRequests((prev) => prev.filter((req) => req._id !== request._id));

      // Optionally refresh to get latest state
      // await loadAvailableRequests();
    } catch (error: any) {
      console.error("Error accepting request:", error);
      Alert.alert("Error", error.message || "Failed to accept request");
    }
  };

  const handleDecline = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    try {
      await socketService.rejectRequest(requestId, user.userId);
      // Remove request locally (real-time update)
      setRequests((prev) => prev.filter((req) => req._id !== requestId));
      setSelectedRequest(null);
      Alert.alert(
        "Declined",
        `Declined consultation request from ${patientName}`,
      );
    } catch (error: any) {
      console.error("Error declining request:", error);
      Alert.alert("Error", error.message || "Failed to decline request");
    }
  };

  const confirmAccept = (request: any) => {
    const patientName = request?.patientId?.fullname || "this patient";
    Alert.alert(
      "Accept Request",
      `Are you sure you want to accept the request from ${patientName}?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Accept", onPress: () => handleAccept(request) },
      ],
      { cancelable: true },
    );
  };

  const confirmDecline = (requestId: string, patientName: string) => {
    Alert.alert(
      "Decline Request",
      `Are you sure you want to decline the request from ${patientName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Decline",
          style: "destructive",
          onPress: () => handleDecline(requestId, patientName),
        },
      ],
      { cancelable: true },
    );
  };

  const greeting = getGreeting();

  return (
    <SafeAreaView
      className="flex-1 bg-gray-50"
      edges={["bottom", "left", "right"]}
    >
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={["#3B82F6"]}
            tintColor="#3B82F6"
          />
        }
      >
        {/* Header with provider name + Online/Offline toggle */}
        <View className="bg-white pt-6 pb-4 px-6 border-b border-gray-200">
          <View className="flex-row items-center justify-between">
            <View>
              <Text className="text-sm text-gray-500">{greeting}</Text>
              <Text className="text-2xl font-bold text-gray-900 mt-1">
                {user?.fullname || "Provider"}
              </Text>
            </View>

            {/* Online/Offline toggle button */}
            <TouchableOpacity
              onPress={toggleOnline}
              className={`flex-row items-center px-5 py-2.5 rounded-full ${
                isOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            >
              <View
                className={`w-2 h-2 rounded-full mr-2 ${
                  isOnline ? "bg-white" : "bg-gray-200"
                }`}
              />
              <Text className="text-white font-bold text-sm">
                {isOnline ? "Online" : "Offline"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Verification Status Banner */}
        {!user?.isDocumentVerified && (
          <View className="px-6 pt-4">
            <View className="bg-amber-50 border-l-4 border-amber-500 rounded-lg p-4">
              <View className="flex-row items-start">
                <Feather
                  name="alert-circle"
                  size={20}
                  color="#F59E0B"
                  style={{ marginRight: 12, marginTop: 2 }}
                />
                <View className="flex-1">
                  <Text className="text-amber-900 font-bold text-base mb-1">
                    Account Under Review
                  </Text>
                  <Text className="text-amber-800 text-sm leading-5">
                    Your documents are currently being verified by our admin
                    team. You'll be notified once your account is approved and
                    you can start accepting consultations.
                  </Text>
                  <TouchableOpacity
                    onPress={() => router.push("/(app)/(provider)/profile")}
                    className="mt-3 bg-amber-100 px-3 py-2 rounded-lg self-start"
                  >
                    <Text className="text-amber-900 font-semibold text-sm">
                      View Profile →
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Stats Cards */}
        <View className="px-6 py-6">
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs text-gray-500 uppercase font-bold tracking-wide">
                  Requests
                </Text>
                <View className="w-8 h-8 bg-blue-50 rounded-full items-center justify-center">
                  <Feather name="users" size={16} color="#3B82F6" />
                </View>
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                {requests.length}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">Pending</Text>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/(app)/(provider)/transactions")}
              className="flex-1 bg-white rounded-xl border border-gray-200 p-4 shadow-sm"
              activeOpacity={0.7}
            >
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-xs text-gray-500 uppercase font-bold tracking-wide">
                  Earnings
                </Text>
                <View className="w-8 h-8 bg-green-50 rounded-full items-center justify-center">
                  <Feather name="dollar-sign" size={16} color="#10B981" />
                </View>
              </View>
              <Text className="text-2xl font-bold text-gray-900">
                N$ {monthlyEarnings.toFixed(2)}
              </Text>
              <Text className="text-xs text-gray-500 mt-1">This Month</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Provider map removed from home screen: map only appears in Route modal after Accept */}

        {/* Incoming Consultation Requests */}
        <View className="px-6 pb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text className="text-lg font-bold text-gray-900">
                Incoming Requests
              </Text>
              <Text className="text-xs text-gray-500 mt-0.5">
                {isOnline
                  ? "New requests appear here in real time."
                  : "Go online to start receiving requests."}
              </Text>
            </View>
            <View className="flex-row items-center" style={{ gap: 8 }}>
              <View
                className={`px-3 py-1 rounded-full border ${
                  isOnline
                    ? "bg-green-50 border-green-200"
                    : "bg-gray-50 border-gray-200"
                }`}
              >
                <Text
                  className={`text-xs font-bold ${
                    isOnline ? "text-green-700" : "text-gray-600"
                  }`}
                >
                  {isOnline ? "ONLINE" : "OFFLINE"}
                </Text>
              </View>
              <View className="px-3 py-1 rounded-full bg-blue-50 border border-blue-200">
                <Text className="text-xs font-bold text-blue-700">
                  {isOnline ? requests.length : 0}
                </Text>
              </View>
            </View>
          </View>

          {!isOnline ? (
            <View className="bg-white rounded-2xl border border-gray-200 p-6">
              <View className="flex-row items-start">
                <View className="w-12 h-12 bg-gray-100 rounded-2xl items-center justify-center mr-4">
                  <Feather name="power" size={22} color="#6B7280" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">
                    You’re offline
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1 leading-5">
                    Switch to online to receive nearby consultation requests.
                  </Text>
                </View>
              </View>
            </View>
          ) : isLoadingRequests ? (
            <View className="bg-white rounded-2xl border border-gray-200 p-6">
              <View className="flex-row items-center">
                <View className="w-12 h-12 bg-blue-50 rounded-2xl items-center justify-center mr-4">
                  <ActivityIndicator size="small" color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">
                    Checking for new requests…
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1">
                    Please wait a moment.
                  </Text>
                </View>
              </View>
            </View>
          ) : requests.length === 0 ? (
            <View className="bg-white rounded-2xl border border-gray-200 p-6">
              <View className="flex-row items-start">
                <View className="w-12 h-12 bg-green-50 rounded-2xl items-center justify-center mr-4">
                  <Feather name="check-circle" size={22} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">
                    You’re all caught up
                  </Text>
                  <Text className="text-sm text-gray-600 mt-1 leading-5">
                    No pending consultation requests right now.
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            requests.map((request) => {
              const patientName =
                request.patientId?.fullname || "Unknown Patient";
              const ailment = request.ailmentCategory || "Consultation";
              const fee = `N$ ${request.estimatedCost || 0}`;
              const consultationMode: "house_visit" | "video_consultation" =
                request.consultationMode === "video_consultation"
                  ? "video_consultation"
                  : "house_visit";
              const consultationModeMeta =
                consultationMode === "video_consultation"
                  ? {
                      label: "Video Consultation",
                      icon: "video",
                      bgClass: "bg-blue-50 border-blue-200",
                      textClass: "text-blue-700",
                      iconColor: "#1D4ED8",
                    }
                  : {
                      label: "House Visit",
                      icon: "home",
                      bgClass: "bg-emerald-50 border-emerald-200",
                      textClass: "text-emerald-700",
                      iconColor: "#047857",
                    };

              let distance = "-- km";
              const patientCoords = normalizeCoordinateOrUndefined(
                request.address?.coordinates,
              );

              if (providerLocation && patientCoords) {
                const dist = calculateDistance(
                  providerLocation.latitude,
                  providerLocation.longitude,
                  patientCoords.latitude,
                  patientCoords.longitude,
                );
                distance = `${dist} km`;
              }

              return (
                <TouchableOpacity
                  key={request._id}
                  onPress={() => setSelectedRequest(request)}
                  className="bg-white rounded-xl border border-gray-200 p-4 mb-3"
                >
                  <View className="flex-row items-start justify-between mb-2">
                    <View className="flex-1">
                      <Text className="text-base font-bold text-gray-900">
                        {patientName}
                      </Text>
                    </View>
                    <View className="bg-blue-50 px-2.5 py-1 rounded-md">
                      <Text className="text-blue-700 text-[11px] font-semibold">
                        New
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center mb-2">
                    <Feather name="alert-circle" size={14} color="#6B7280" />
                    <Text className="text-sm text-gray-700 ml-2">{ailment}</Text>
                  </View>
                  <View className="flex-row items-center mb-3">
                    <Feather name="map-pin" size={14} color="#6B7280" />
                    <Text className="text-sm text-gray-600 ml-2">{distance}</Text>
                  </View>

                  <View className="flex-row items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 mb-3">
                    <View
                      className={`${consultationModeMeta.bgClass} border px-2.5 py-1 rounded-md flex-row items-center`}
                    >
                      <Feather
                        name={consultationModeMeta.icon as any}
                        size={12}
                        color={consultationModeMeta.iconColor}
                      />
                      <Text
                        className={`text-xs font-semibold ml-1.5 ${consultationModeMeta.textClass}`}
                      >
                        {consultationModeMeta.label}
                      </Text>
                    </View>
                    <Text className="text-sm font-semibold text-gray-500">
                      Fee:
                    </Text>
                    <Text className="text-base text-gray-900 font-bold">
                      {fee}
                    </Text>
                  </View>

                  <View className="flex-row" style={{ gap: 10 }}>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmDecline(request._id, patientName);
                      }}
                      className="flex-1 bg-gray-100 py-3 rounded-lg border border-gray-200"
                      activeOpacity={0.85}
                    >
                      <View className="flex-row items-center justify-center">
                        <Feather name="x" size={16} color="#374151" />
                        <Text className="text-gray-800 font-semibold text-center ml-2">
                          Decline
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={(e) => {
                        e.stopPropagation();
                        confirmAccept(request);
                      }}
                      className="flex-1 bg-blue-600 py-3 rounded-xl"
                      activeOpacity={0.9}
                    >
                      <View className="flex-row items-center justify-center">
                        <Feather name="check" size={16} color="#fff" />
                        <Text className="text-white font-semibold text-center ml-2">
                          Accept
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* --- MODAL WITH TRANSPARENT BACKGROUND --- */}
      {selectedRequest && (
        <Modal
          animationType="slide"
          transparent={true}
          visible={!!selectedRequest}
          onRequestClose={() => setSelectedRequest(null)}
        >
          <View style={styles.modalOverlay}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={() => setSelectedRequest(null)}
            />
            <View className="bg-white rounded-2xl p-6 w-11/12 max-w-lg">
              {/* Header */}
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-xl font-bold text-gray-900">
                  Request Details
                </Text>
                <TouchableOpacity
                  onPress={() => setSelectedRequest(null)}
                  className="w-8 h-8 bg-gray-100 rounded-full items-center justify-center"
                >
                  <Feather name="x" size={18} color="#6B7280" />
                </TouchableOpacity>
              </View>

              {/* Patient Info */}
              <View className="bg-gray-50 rounded-xl p-4 mb-4">
                <Text className="text-lg font-bold text-gray-900 mb-2">
                  {selectedRequest.patientId?.fullname || "Unknown Patient"}
                </Text>
                <View className="flex-row items-center mb-2">
                  <Feather name="alert-circle" size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-2">
                    {selectedRequest.ailmentCategory}
                  </Text>
                </View>
                <View
                  className={`self-start mb-2 px-3 py-1 rounded-full border flex-row items-center ${
                    selectedRequest.consultationMode === "video_consultation"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-emerald-50 border-emerald-200"
                  }`}
                >
                  <Feather
                    name={
                      selectedRequest.consultationMode === "video_consultation"
                        ? "video"
                        : "home"
                    }
                    size={12}
                    color={
                      selectedRequest.consultationMode === "video_consultation"
                        ? "#1D4ED8"
                        : "#047857"
                    }
                  />
                  <Text
                    className={`text-xs font-bold ml-1.5 ${
                      selectedRequest.consultationMode === "video_consultation"
                        ? "text-blue-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {selectedRequest.consultationMode === "video_consultation"
                      ? "Video Consultation"
                      : "House Visit"}
                  </Text>
                </View>
                {selectedRequest.symptoms && (
                  <View className="mt-2">
                    <Text className="text-xs text-gray-500 mb-1">
                      Symptoms:
                    </Text>
                    <Text className="text-sm text-gray-700">
                      {selectedRequest.symptoms}
                    </Text>
                  </View>
                )}
                <View className="flex-row items-center mt-2">
                  <Feather name="map-pin" size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-2">
                    {selectedRequest.address?.locality || "Unknown location"}
                  </Text>
                </View>
              </View>

              {/* Fee Breakdown */}
              <View className="bg-blue-50 rounded-xl p-4 mb-4">
                <View className="flex-row justify-between mb-3">
                  <Text className="text-sm text-gray-700">
                    Consultation Fee:
                  </Text>
                  <Text className="text-base font-bold text-gray-900">
                    N$ {selectedRequest.estimatedCost || 0}
                  </Text>
                </View>
              </View>

              {/* Map */}
              {(() => {
                const coords = normalizeCoordinateOrUndefined(
                  selectedRequest.address?.coordinates,
                );
                if (!coords) return null;

                logViewMountDebug("ProviderHomeRequestModal", "rendering map", {
                  requestId: selectedRequest._id,
                  coords,
                  patientName: selectedRequest.patientId?.fullname,
                });

                return (
                  <View className="mb-4">
                    <View className="flex-row items-center justify-between mb-3">
                      <Text className="text-base font-bold text-gray-900">
                        Location
                      </Text>
                    </View>

                    <View className="rounded-xl overflow-hidden h-48 bg-gray-100 border border-gray-200">
                      <MapView
                        style={styles.map}
                        pointerEvents="auto"
                        scrollEnabled
                        zoomEnabled
                        rotateEnabled
                        pitchEnabled
                        initialRegion={{
                          latitude: coords.latitude,
                          longitude: coords.longitude,
                          latitudeDelta: 0.01,
                          longitudeDelta: 0.01,
                        }}
                        onLayout={(event) => {
                          logViewMountDebug(
                            "ProviderHomeRequestModal",
                            "MapView layout",
                            {
                              layout: event.nativeEvent.layout,
                              requestId: selectedRequest._id,
                              coords,
                            },
                          );
                        }}
                        onMapReady={() => {
                          logViewMountDebug(
                            "ProviderHomeRequestModal",
                            "MapView ready",
                            {
                              requestId: selectedRequest._id,
                              coords,
                            },
                          );
                        }}
                        provider={PROVIDER_GOOGLE}
                      >
                        <Marker
                          coordinate={coords}
                          title={selectedRequest.patientId?.fullname}
                          description={selectedRequest.ailmentCategory}
                        />
                      </MapView>
                    </View>
                  </View>
                );
              })()}

              {/* Actions */}
              <View className="flex-row" style={{ gap: 10 }}>
                <TouchableOpacity
                  onPress={() =>
                    confirmDecline(
                      selectedRequest._id,
                      selectedRequest.patientId?.fullname || "Unknown",
                    )
                  }
                  className="flex-1 bg-gray-100 py-3.5 rounded-xl border border-gray-200"
                >
                  <Text className="text-gray-700 font-bold text-center">
                    Decline
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => confirmAccept(selectedRequest)}
                  className="flex-1 bg-blue-600 py-3.5 rounded-xl"
                >
                  <Text className="text-white font-bold text-center">
                    Accept Request
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Route handling moved to GlobalRouteModal via RouteContext */}
      {/* Route handling moved to GlobalRouteModal via RouteContext */}

      {/* First-time user welcome modal (provider) */}
      <Modal visible={showWelcomeModal} animationType="slide" transparent>
        <View className="flex-1 justify-end items-center bg-black/50">
          <View
            className="bg-white rounded-t-3xl p-6 w-full"
            style={{ height: "65%" }}
          >
            {/* Progress */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-gray-600">
                  Step {currentOnboardingStep + 1} of {onboardingSteps.length}
                </Text>
                <TouchableOpacity onPress={handleOnboardingSkip}>
                  <Text className="text-sm text-blue-600 font-semibold">
                    Skip
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="w-full h-2 bg-gray-200 rounded-full">
                <View
                  style={{
                    height: "100%",
                    backgroundColor: "#FACC15",
                    borderRadius: 999,
                    width: `${((currentOnboardingStep + 1) / onboardingSteps.length) * 100}%`,
                  }}
                />
              </View>
            </View>

            {/* Content */}
            <View className="flex-1 justify-center items-center">
              {onboardingSteps[currentOnboardingStep].image ? (
                <View className="w-40 h-40 rounded-full overflow-hidden mb-6 bg-gray-100">
                  <Image
                    source={require("../../../assets/images/connectlogo.png")}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="cover"
                  />
                </View>
              ) : (
                <View className="w-24 h-24 bg-green-100 rounded-full justify-center items-center mb-6">
                  <MaterialCommunityIcons
                    name={onboardingSteps[currentOnboardingStep].icon}
                    size={48}
                    color="#CA8A04"
                  />
                </View>
              )}

              <Text className="text-2xl font-bold text-center mb-4 text-gray-800">
                {onboardingSteps[currentOnboardingStep].title}
              </Text>
              <Text className="text-base text-center text-gray-600 mb-8 px-4 leading-6">
                {onboardingSteps[currentOnboardingStep].description}
              </Text>
            </View>

            {/* Navigation */}
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={handleOnboardingPrevious}
                className={`flex-1 mr-2 p-4 rounded-lg border border-gray-300 ${
                  currentOnboardingStep === 0 ? "opacity-50" : ""
                }`}
                disabled={currentOnboardingStep === 0}
              >
                <Text className="text-center text-gray-700 font-semibold">
                  Previous
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleOnboardingNext}
                className="flex-1 ml-2 p-4 rounded-lg bg-green-500"
              >
                <Text className="text-center text-white font-bold">
                  {currentOnboardingStep === onboardingSteps.length - 1
                    ? "Get Started!"
                    : "Next"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Dots */}
            <View className="flex-row justify-center items-center mt-4">
              {onboardingSteps.map((step, index) => (
                <View
                  key={step.id}
                  className={`w-2 h-2 rounded-full mx-1 ${
                    index === currentOnboardingStep
                      ? "bg-green-500"
                      : "bg-gray-300"
                  }`}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
});
