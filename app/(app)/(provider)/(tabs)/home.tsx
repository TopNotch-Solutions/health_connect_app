// app/(provider)/home.tsx

import { normalizeCoordinateOrUndefined, getPatientLocationFromRequest } from "@/lib/coordinate";
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
import MapView, { Marker } from "react-native-maps";
import { MAP_PROVIDER } from "@/lib/map";
import {
  AppHeroCard,
  AppQuickActionsRow,
  AppSectionHeader,
  appScreenStyles,
  getFirstName,
  getGreeting,
  getGreetingEmoji,
} from "../../../../components/app/AppScreenUI";
import ScreenLayout, { SCREEN_EDGES_STACK } from "../../../../components/ScreenLayout";
import { AuthBackgroundDecor } from "../../../../components/AuthScreenLayout";
import { useAuth } from "../../../../context/AuthContext";
import { useRoute } from "../../../../context/RouteContext";
import apiClient from "../../../../lib/api";
import { alertNewRequestAvailable } from "../../../../lib/consultationAlert";
import { hapticActionConfirm } from "../../../../lib/haptics";
import {
  ensureForegroundLocationPermission,
  getCurrentPositionWithTimeout,
  resolveProviderCoordsForAccept,
} from "../../../../lib/locationPermission";
import {
  providerOnlineStorageKey as onlineStorageKeyForUser,
  setProviderOnline,
} from "../../../../lib/providerOnline";
import socketService from "../../../../lib/socket";
import { getUserFacingErrorMessage } from "../../../../lib/userFacingError";
import { logViewMountDebug } from "../../../../lib/viewErrorLogger";
import { AUTH_COLORS } from "../../../../lib/authScreenTheme";
import { canShowPatientPhone } from "../../../../lib/patientContactVisibility";
import PostalAddressConfirmModal from "../../../../components/(patient)/PostalAddressConfirmModal";
import { showAlertDialog } from "@/components/AlertDialog";

export default function ProviderHome() {
  const INCOMING_PAGE_SIZE = 20;
  const [requests, setRequests] = useState<any[]>([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);
  const [isLoadingMoreRequests, setIsLoadingMoreRequests] = useState(false);
  const [incomingHasMore, setIncomingHasMore] = useState(false);
  const [incomingTotal, setIncomingTotal] = useState(0);
  const loadedIncomingCountRef = useRef(INCOMING_PAGE_SIZE);
  const requestsRef = useRef<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [monthlyEarnings, setMonthlyEarnings] = useState(0);
  const [medicalAidEligible, setMedicalAidEligible] = useState(false);
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(0);
  const [showPostalAddressModal, setShowPostalAddressModal] = useState(false);
  const [pendingAcceptRequest, setPendingAcceptRequest] = useState<any | null>(
    null,
  );
  const [actionLoading, setActionLoading] = useState<{
    requestId: string;
    action: "accept" | "decline";
  } | null>(null);
  const acceptInFlightRef = useRef(false);
  const { user, updateUser } = useAuth();
  const router = useRouter();

  // Online/Offline toggle - provider can manually toggle, but only if verified
  const [isOnline, setIsOnline] = useState(false);
  const onlineHydratedRef = useRef(false);
  const providerOnlineStorageKey = user?.userId
    ? onlineStorageKeyForUser(user.userId)
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
    setIsOnline((prev) => {
      const next = !prev;
      // Sync alert flag immediately so new-request voice isn't skipped
      // while React is still flushing the Online UI state.
      setProviderOnline(next);
      return next;
    });
  };

  // Load persisted online/offline state for this provider
  useEffect(() => {
    onlineHydratedRef.current = false;
    const loadPersistedOnlineState = async () => {
      if (!providerOnlineStorageKey) return;
      try {
        const stored = await AsyncStorage.getItem(providerOnlineStorageKey);
        const parsed = stored === "true";

        // If verification is missing, always force offline
        if (!user?.isDocumentVerified) {
          setIsOnline(false);
          setProviderOnline(false);
          await AsyncStorage.setItem(providerOnlineStorageKey, "false");
          onlineHydratedRef.current = true;
          return;
        }

        setIsOnline(parsed);
        setProviderOnline(parsed);
      } catch (error) {
        console.error("Error loading provider online state:", error);
      } finally {
        onlineHydratedRef.current = true;
      }
    };

    loadPersistedOnlineState();
  }, [providerOnlineStorageKey, user?.isDocumentVerified]);

  // Persist online/offline state whenever it changes (also sync for voice alerts).
  // Skip until hydrated so the default false does not wipe a saved Online state.
  useEffect(() => {
    if (!onlineHydratedRef.current) return;

    const effectiveOnline = isOnline && !!user?.isDocumentVerified;
    setProviderOnline(effectiveOnline);

    const persistOnlineState = async () => {
      if (!providerOnlineStorageKey) return;
      try {
        await AsyncStorage.setItem(
          providerOnlineStorageKey,
          String(effectiveOnline),
        );
      } catch (error) {
        console.error("Error persisting provider online state:", error);
      }
    };
    persistOnlineState();
  }, [isOnline, providerOnlineStorageKey, user?.isDocumentVerified]);

  const [selectedRequest, setSelectedRequest] = useState<null | any>(null);
  // iOS blanks MapView if mounted in the same frame as the request Modal
  const [showDetailMap, setShowDetailMap] = useState(false);
  const [providerLocation, setProviderLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const locationWatcherRef = useRef<Location.LocationSubscription | null>(null);
  const latestProviderLocationRef = useRef<{
    latitude: number;
    longitude: number;
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
  // Background sync only � sockets push new requests immediately.
  const REQUESTS_REFRESH_INTERVAL_MS = 30000;
  const hasLoadedRequestsOnceRef = useRef(false);

  useEffect(() => {
    latestProviderLocationRef.current = providerLocation;
  }, [providerLocation]);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  useEffect(() => {
    if (!selectedRequest) {
      setShowDetailMap(false);
      return;
    }
    setShowDetailMap(false);
    const timer = setTimeout(() => setShowDetailMap(true), 300);
    return () => clearTimeout(timer);
  }, [selectedRequest?._id]);

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

  // Medical aid eligibility � show home quick action when specializations match ICD-10
  const loadMedicalAidEligibility = useCallback(async () => {
    try {
      const response = await apiClient.get("/app/medical-aid/provider-stats");
      const data = response.data;
      setMedicalAidEligible(Boolean(data?.eligible));
    } catch (error) {
      console.error("Error loading medical aid eligibility:", error);
      setMedicalAidEligible(false);
    }
  }, []);

  // Helper function to fetch and update user details
  const fetchAndUpdateUserDetails = useCallback(async () => {
    if (!user?.userId) return;
    try {
      const userResponse = await apiClient.get("/app/auth/user-details/");
      if (userResponse.data?.status && userResponse.data?.user) {
        updateUser(userResponse.data.user);
      }
    } catch (error) {
      console.error("Error fetching user details:", error);
    }
  }, []);

  // Use ref to prevent multiple simultaneous loads
  const isLoadingRequestsRef = useRef(false);
  const isLoadingMoreRequestsRef = useRef(false);

  // Define loadAvailableRequests before using it in useEffect
  const loadAvailableRequests = useCallback(async (
    locationOverride?: { latitude: number; longitude: number } | null,
    options?: { append?: boolean; silent?: boolean },
  ) => {
    if (!user?.userId) {
      return;
    }

    const currentProviderLocation =
      locationOverride ?? latestProviderLocationRef.current;
    if (
      !currentProviderLocation ||
      typeof currentProviderLocation.latitude !== "number" ||
      typeof currentProviderLocation.longitude !== "number"
    ) {
      return;
    }

    const append = Boolean(options?.append);
    // Background polls / focus refreshes stay silent so the list doesn't flicker.
    const silent =
      Boolean(options?.silent) || hasLoadedRequestsOnceRef.current;

    if (append) {
      if (isLoadingMoreRequestsRef.current || isLoadingRequestsRef.current) {
        return;
      }
      isLoadingMoreRequestsRef.current = true;
      setIsLoadingMoreRequests(true);
    } else if (isLoadingRequestsRef.current) {
      return;
    } else {
      isLoadingRequestsRef.current = true;
      if (!silent) {
        setIsLoadingRequests(true);
      }
    }

    try {
      // Wait for socket to be ready
      await socketService.waitForConnection(10000);

      if (append) {
        const nextPage =
          Math.floor(loadedIncomingCountRef.current / INCOMING_PAGE_SIZE) + 1;
        const result = await socketService.getAvailableRequests(
          user.userId,
          currentProviderLocation,
          { page: nextPage, limit: INCOMING_PAGE_SIZE },
        );
        const nextItems = Array.isArray(result.requests) ? result.requests : [];
        setRequests((prev) => {
          const seen = new Set(prev.map((r) => String(r._id)));
          const merged = [
            ...prev,
            ...nextItems.filter((r) => !seen.has(String(r._id))),
          ];
          loadedIncomingCountRef.current = merged.length;
          return merged;
        });
        setIncomingHasMore(Boolean(result.pagination?.hasMore));
        setIncomingTotal(Number(result.pagination?.total) || 0);
      } else {
        // Refresh keeps currently loaded window size (at least one page)
        const refreshLimit = Math.max(
          INCOMING_PAGE_SIZE,
          loadedIncomingCountRef.current || INCOMING_PAGE_SIZE,
        );
        const result = await socketService.getAvailableRequests(
          user.userId,
          currentProviderLocation,
          { page: 1, limit: refreshLimit },
        );
        const items = Array.isArray(result.requests) ? result.requests : [];
        const previousIds = new Set(
          (requestsRef.current || []).map((row) => String(row?._id)),
        );
        const newIds = items
          .map((row) => String(row?._id))
          .filter((id) => id && !previousIds.has(id));
        const discoveredNew =
          silent &&
          hasLoadedRequestsOnceRef.current &&
          newIds.length > 0;

        setRequests((prev) => {
          // Avoid re-render flicker when nothing meaningful changed
          if (
            prev.length === items.length &&
            prev.every((row, index) => {
              const next = items[index];
              return (
                String(row?._id) === String(next?._id) &&
                row?.status === next?.status
              );
            })
          ) {
            return prev;
          }
          return items;
        });
        requestsRef.current = items;
        loadedIncomingCountRef.current = Math.max(
          INCOMING_PAGE_SIZE,
          items.length,
        );
        setIncomingHasMore(Boolean(result.pagination?.hasMore));
        setIncomingTotal(Number(result.pagination?.total) || items.length);
        hasLoadedRequestsOnceRef.current = true;

        // Keep socket GPS fresh so backend can push newRequestAvailable
        socketService.syncProviderSocketLocation(currentProviderLocation);

        // Socket push can miss while poll still shows the job � announce new IDs.
        if (discoveredNew) {
          void alertNewRequestAvailable(newIds[0]);
        }
      }
    } catch (error: any) {
      console.error("? Error loading requests:", error);
      console.warn(
        "Failed to load available requests, will retry on next refresh:",
        error?.message || error,
      );
    } finally {
      if (append) {
        setIsLoadingMoreRequests(false);
        isLoadingMoreRequestsRef.current = false;
      } else {
        setIsLoadingRequests(false);
        isLoadingRequestsRef.current = false;
      }
    }
  }, [user?.userId]);

  const loadMoreIncomingRequests = useCallback(() => {
    if (!incomingHasMore || isLoadingMoreRequests || isLoadingRequests) return;
    loadAvailableRequests(undefined, { append: true });
  }, [
    incomingHasMore,
    isLoadingMoreRequests,
    isLoadingRequests,
    loadAvailableRequests,
  ]);

  // Connect socket and fetch available requests only when online
  useEffect(() => {
    if (user?.userId && isOnline) {
      // Seed cached GPS before join so backend logs hasLocation: true when possible.
      if (latestProviderLocationRef.current) {
        socketService.setLastKnownProviderLocation(
          latestProviderLocationRef.current,
        );
      } else {
        void Location.getLastKnownPositionAsync()
          .then((last) => {
            if (!last?.coords) return;
            const coords = {
              latitude: last.coords.latitude,
              longitude: last.coords.longitude,
            };
            setProviderLocation(coords);
            socketService.setLastKnownProviderLocation(coords);
            if (socketService.getSocket()?.connected) {
              socketService.syncProviderSocketLocation(coords);
            }
          })
          .catch(() => {});
      }

      // Only connect if not already connected for this online session
      const socket = socketService.getSocket();
      if (!socket?.connected) {
        const normalizedRole =
          typeof user.role === "string" ? user.role.toLowerCase() : undefined;
        socketService.connect(
          user.userId,
          normalizedRole as
            | "patient"
            | "doctor"
            | "nurse"
            | "physiotherapist"
            | "social worker"
            | "pharmacist"
            | undefined,
        );
      } else if (latestProviderLocationRef.current) {
        socketService.syncProviderSocketLocation(
          latestProviderLocationRef.current,
        );
      }

      const currentSocket = socketService.getSocket();

      // Only set up connect handler if we haven't already handled it for this online session
      if (!socketConnectedRef.current) {
        // Listen for connect event - only load once per online toggle
        const handleConnect = () => {
          if (socketConnectedRef.current || !isOnline) {
            return;
          }
          socketConnectedRef.current = true;
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
          setTimeout(() => {
            if (!isLoadingRequestsRef.current && isOnline) {
              loadAvailableRequests();
            }
          }, 500);
        } else {
          currentSocket?.once("connect", handleConnect);
        }

        return () => {
          currentSocket?.off("connect", handleConnect);
          // Don't reset socketConnectedRef here - let it reset when going offline
        };
      }
    } else if (!isOnline) {
      // Clean up when going offline
      setRequests([]);
      requestsRef.current = [];
      setIncomingHasMore(false);
      setIncomingTotal(0);
      loadedIncomingCountRef.current = INCOMING_PAGE_SIZE;
      hasLoadedRequestsOnceRef.current = false;
      isLoadingRequestsRef.current = false;
      isLoadingMoreRequestsRef.current = false;
      setIsLoadingRequests(false);
      setIsLoadingMoreRequests(false);
      socketConnectedRef.current = false;

      // Clean up socket listeners if they were set up
      if (socketListenersCleanupRef.current) {
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
        const { granted } = await ensureForegroundLocationPermission({
          requestIfNeeded: true,
        });
        if (!granted) {
          console.warn("Location permission not granted for provider map");

          showAlertDialog(
            "Location Permission Required",
            "HealthConnect needs access to your location so we can show nearby patient requests. Please enable location in your device settings.",
            [
              { text: "Cancel", style: "cancel" },
              {
                text: "Open Settings",
                onPress: () => {
                  try {
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

        // Prefer last-known / cached coords so socket join gets hasLocation:true quickly.
        let initialCoords = await resolveProviderCoordsForAccept(
          latestProviderLocationRef.current,
        ).catch(async () => {
          const loc = await getCurrentPositionWithTimeout({ timeoutMs: 10000 });
          return {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          };
        });

        if (!active) return;

        setProviderLocation(initialCoords);
        socketService.syncProviderSocketLocation(initialCoords);

        // Force one refresh after acquiring initial coordinates for online mode.
        if (isOnline && !isLoadingRequestsRef.current) {
          await loadAvailableRequests(initialCoords);
        }

        stopLocationWatch();
        locationWatcherRef.current = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.Balanced,
            timeInterval: 15000,
            distanceInterval: 50,
          },
          (position) => {
            if (!active || !isOnline) return;

            const nextCoords = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            };
            // Keep providerLocation state + server socket GPS current for accept.
            setProviderLocation(nextCoords);
            socketService.syncProviderSocketLocation(nextCoords);
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
    }

    return () => {
      active = false;
      stopLocationWatch();
    };
  }, [isOnline, loadAvailableRequests]);

  // Automatically set provider offline if document verification is lost
  useEffect(() => {
    if (user?.isDocumentVerified === false && isOnline) {
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

      // Fetch user details and earnings
      fetchAndUpdateUserDetails();
      loadMonthlyEarnings();
      loadMedicalAidEligibility();

      // If online, silently refresh requests in the background
      if (isOnline && user?.userId && !isLoadingRequestsRef.current) {
        const socket = socketService.getSocket();
        if (socket?.connected) {
          // Small delay to ensure socket is ready
          setTimeout(() => {
            if (!isLoadingRequestsRef.current) {
              loadAvailableRequests(undefined, { silent: true });
            }
          }, 300);
        } else {
          console.warn(
            "?? Socket not connected on focus, will wait for connection",
          );
        }
      }
    }, [
      fetchAndUpdateUserDetails,
      loadMonthlyEarnings,
      loadMedicalAidEligibility,
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
      await loadMedicalAidEligibility();
      // Then refresh requests if online (only if not already loading)
      if (isOnline && !isLoadingRequestsRef.current) {
        await loadAvailableRequests();
      }
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [
    fetchAndUpdateUserDetails,
    loadMonthlyEarnings,
    loadMedicalAidEligibility,
    isOnline,
  ]);

  // Silent background sync while online � does not show the loading card.
  useEffect(() => {
    if (!isOnline || !user?.userId) return;

    const intervalId = setInterval(() => {
      if (!isLoadingRequestsRef.current) {
        loadAvailableRequests(undefined, { silent: true });
      }
    }, REQUESTS_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(intervalId);
    };
  }, [isOnline, user?.userId, loadAvailableRequests]);

  // Listen for real-time socket events - set up once when online, clean up when offline
  useEffect(() => {
    if (!isOnline || !user?.userId) {
      return; // Cleanup is handled in the socket connection useEffect when going offline
    }

    // Prevent setting up listeners multiple times for the same online session
    if (socketListenersSetupRef.current) {
      return;
    }

    const socket = socketService.getSocket();
    if (!socket?.connected) {
      console.warn(
        "?? Socket not connected, will set up listeners when connected",
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
        return;
      }

      socketListenersSetupRef.current = true;
      // Ensure voice alerts are armed whenever realtime listeners are live
      setProviderOnline(true);

            // Voice alerts for socket events live in useConsultationStatusAlerts (tabs layout).
      const handleNewRequest = (request: any) => {
        setRequests((prev) => {
          if (prev.some((req) => String(req._id) === String(request._id))) {
            return prev;
          }
          const next = [request, ...prev];
          requestsRef.current = next;
          return next;
        });
      };

      // Handle request status changes (e.g., accepted by another provider, cancelled)
      const handleRequestStatusChanged = (data: any) => {
        if (!isOnline) return; // Ignore if went offline
        if (!data.requestId) return;
        setRequests((prev) =>
          prev.filter((req) => req._id !== data.requestId),
        );
      };

      // Handle request updates (when request is accepted/rejected/cancelled)
      const handleRequestUpdated = (data: any) => {
        if (!isOnline) return; // Ignore if went offline
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
          if (data.status === "completed") {
            loadMonthlyEarnings();
          }
        }
      };

      // Handle request hidden (when rejected)
      const handleRequestHidden = (data: any) => {
        if (!isOnline) return; // Ignore if went offline
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

  // Pharmacist accept: get real device location then assign the request, then go to requests tab
  const handlePharmacistAccept = async (request: any) => {
    if (!user?.userId) return;
    if (acceptInFlightRef.current || actionLoading) {
      return;
    }
    if (!user.isDocumentVerified) {
      Alert.alert(
        "Account Not Verified",
        "Your account is still under review. You cannot accept requests until your documents have been verified.",
        [{ text: "OK" }],
      );
      return;
    }
    acceptInFlightRef.current = true;
    setActionLoading({ requestId: request._id, action: "accept" });
    try {
      const { granted } = await ensureForegroundLocationPermission({
        requestIfNeeded: true,
      });
      if (!granted) {
        Alert.alert(
          "Location Required",
          "Location permission is required to accept requests.",
        );
        return;
      }
      const coords = await resolveProviderCoordsForAccept(
        latestProviderLocationRef.current,
      );
      setProviderLocation(coords);
      await socketService.acceptRequest(request._id, user.userId, coords);
      hapticActionConfirm();
      setRequests((prev) => prev.filter((r) => r._id !== request._id));
      setSelectedRequest(null);
      router.push("/(app)/(provider)/requests" as any);
    } catch (err: any) {
      console.error("Pharmacist accept error:", err);
      Alert.alert(
        "Error",
        getUserFacingErrorMessage(err, "Failed to accept request."),
      );
    } finally {
      acceptInFlightRef.current = false;
      setActionLoading((prev) =>
        prev?.requestId === request._id ? null : prev,
      );
    }
  };

  const handleAccept = async (request: any) => {
    // Double check user is available
    if (!user || !user.userId) {
      console.error("Cannot accept request: user is not available");
      Alert.alert("Error", "User session not available. Please try again.");
      return;
    }

    if (acceptInFlightRef.current || actionLoading) {
      Alert.alert(
        "Please wait",
        "Your previous accept is still processing. Wait a moment and try again.",
      );
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

    acceptInFlightRef.current = true;
    setActionLoading({ requestId: request._id, action: "accept" });
    try {
      // 1) Prefer cached GPS so accept can emit without waiting on a fresh fix
      const { granted } = await ensureForegroundLocationPermission({
        requestIfNeeded: true,
      });
      if (!granted) {
        Alert.alert(
          "Location Required",
          "Location permission is required to accept consultation requests.",
        );
        return;
      }

      const providerCoords = await resolveProviderCoordsForAccept(
        latestProviderLocationRef.current,
      );
      setProviderLocation(providerCoords);

      // 2) Accept on backend (assign provider)
      await socketService.acceptRequest(
        request._id,
        currentUserId,
        providerCoords,
      );

      // Confirm acceptance with a light haptic tap
      hapticActionConfirm();

      // Remove from home list and open requests tab after accept
      setSelectedRequest(null);
      setRequests((prev) => prev.filter((req) => req._id !== request._id));
      router.push("/(app)/(provider)/requests" as any);

      if (request.consultationMode === "video_consultation") {
        return;
      }

      // House visit: mark en_route + open navigation in background so accept never feels stuck
      const patientCoords = getPatientLocationFromRequest(request);
      setTimeout(() => {
        startRoute({
          ...request,
          status: "en_route",
          address: {
            ...request.address,
            ...(patientCoords ? { coordinates: patientCoords } : {}),
          },
        });
      }, 350);

      void (async () => {
        try {
          await socketService.updateRequestStatus(
            request._id,
            currentUserId,
            "en_route",
            providerCoords,
          );
        } catch (bgError: any) {
          console.warn(
            "Failed to mark en_route after accept:",
            bgError?.message || bgError,
          );
        }
      })();
    } catch (error: any) {
      console.error("Error accepting request:", error);
      Alert.alert(
        "Error",
        getUserFacingErrorMessage(error, "Failed to accept request"),
      );
    } finally {
      acceptInFlightRef.current = false;
      setActionLoading((prev) =>
        prev?.requestId === request._id ? null : prev,
      );
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
      Alert.alert(
        "Error",
        getUserFacingErrorMessage(error, "Failed to decline request"),
      );
    }
  };

  const confirmAccept = (request: any) => {
    // Medical aid claims need the provider's Namibian postal address first.
    if (request?.paymentMethod === "medical_aid") {
      setSelectedRequest(null);
      setPendingAcceptRequest(request);
      setTimeout(() => setShowPostalAddressModal(true), 280);
      return;
    }
    // Match Requests tab: accept immediately. A confirm AlertDialog on top of the
    // home detail Modal often never fires onPress (stacked RN Modals).
    setSelectedRequest(null);
    void handleAccept(request);
  };

  const handleProviderPostalConfirmed = () => {
    const request = pendingAcceptRequest;
    setShowPostalAddressModal(false);
    setPendingAcceptRequest(null);
    if (!request) return;
    void handleAccept(request);
  };

  const confirmDecline = (requestId: string, patientName: string) => {
    showAlertDialog(
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

  // Returns true only when THIS specific request requires a prescription review
  // (pharmacist provider + ailment has requiresPrescription flag OR "prescription" in title).
  // All other requests � even for pharmacists � go through the normal Accept flow.
  const isPrescriptionRequest = (request: any): boolean => {
    if (user?.role !== "pharmacist") return false;
    const titleFromObj =
      typeof request.ailmentCategoryId === "object"
        ? (request.ailmentCategoryId as any)?.title ?? ""
        : "";
    const ailmentTitle = titleFromObj || request.ailmentCategory || "";
    const requiresPrescription =
      typeof request.ailmentCategoryId === "object"
        ? !!(request.ailmentCategoryId as any)?.requiresPrescription
        : false;
    return requiresPrescription || /prescription/i.test(ailmentTitle);
  };

  const getIncomingStatusStyle = (_status?: string) => ({
    bg: AUTH_COLORS.greenSoft,
    text: AUTH_COLORS.greenDark,
    icon: "clock" as const,
  });

  const formatStatusLabel = (status: string) =>
    status
      .split("_")
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  const getPatientInitials = (name: string) => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "?";
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  };

  const getAilmentName = (ailment: any) => {
    if (!ailment) return "Consultation";
    if (typeof ailment === "string") return ailment;
    return ailment.title || "Consultation";
  };

  const formatIncomingDate = (dateString?: string) => {
    if (!dateString) return "Today";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    } catch {
      return "Today";
    }
  };

  const greeting = getGreeting();
  const firstName = getFirstName(user?.fullname);

  const onlineToggle = (
    <TouchableOpacity
      onPress={toggleOnline}
      style={[
        appScreenStyles.onlineToggle,
        { backgroundColor: isOnline ? AUTH_COLORS.green : "#9CA3AF" },
      ]}
      activeOpacity={0.88}
    >
      <View
        style={[
          appScreenStyles.onlineDot,
          { backgroundColor: isOnline ? AUTH_COLORS.white : "#E5E7EB" },
        ]}
      />
      <Text style={appScreenStyles.onlineToggleText}>
        {isOnline ? "Online" : "Offline"}
      </Text>
    </TouchableOpacity>
  );

  return (
    <ScreenLayout edges={SCREEN_EDGES_STACK} backgroundColor={AUTH_COLORS.bg}>
      <View style={styles.screen}>
        <AuthBackgroundDecor />
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={appScreenStyles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[AUTH_COLORS.green]}
            tintColor={AUTH_COLORS.green}
          />
        }
      >
        <AppHeroCard
          eyebrow={`${greeting} ${getGreetingEmoji()}`}
          name={firstName}
          tagline="Manage consultations and grow your practice."
          stats={[
            { icon: "inbox", label: `${requests.length} pending` },
            { icon: "dollar-sign", label: `N$ ${monthlyEarnings.toFixed(0)} this month` },
          ]}
          headerRight={onlineToggle}
        />

        <AppQuickActionsRow
          actions={[
            {
              icon: "inbox",
              label: "Requests",
              primary: true,
              onPress: () => router.push("/(app)/(provider)/requests"),
            },
            {
              icon: "credit-card",
              label: "Account",
              onPress: () => router.push("/(app)/(provider)/wallet"),
            },
            {
              icon: "user",
              label: "Profile",
              onPress: () => router.push("/(app)/(provider)/profile"),
            },
            ...(medicalAidEligible
              ? [
                  {
                    icon: "shield" as const,
                    label: "Medical Aid",
                    onPress: () =>
                      router.push("/(app)/(provider)/medical-aid"),
                  },
                ]
              : []),
          ]}
        />

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
                      View Profile ?
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Incoming Consultation Requests */}
        <View style={appScreenStyles.contentSection}>
          <AppSectionHeader
            icon="inbox"
            title="Incoming requests"
            subtitle={
              isOnline
                ? "New requests appear here in real time"
                : "Go online to start receiving requests"
            }
            onSeeAll={() => router.push("/(app)/(provider)/requests")}
          />

          {!isOnline ? (
            <View style={incomingCardStyles.emptyCard}>
              <View style={incomingCardStyles.emptyIcon}>
                <Feather name="power" size={20} color={AUTH_COLORS.textMuted} />
              </View>
              <View style={incomingCardStyles.emptyCopy}>
                <Text style={incomingCardStyles.emptyTitle}>You're offline</Text>
                <Text style={incomingCardStyles.emptyBody}>
                  Go online to receive nearby consultation requests.
                </Text>
              </View>
            </View>
          ) : isLoadingRequests ? (
            <View style={incomingCardStyles.emptyCard}>
              <View style={incomingCardStyles.emptyIcon}>
                <ActivityIndicator size="small" color={AUTH_COLORS.green} />
              </View>
              <View style={incomingCardStyles.emptyCopy}>
                <Text style={incomingCardStyles.emptyTitle}>
                  Checking for requests?
                </Text>
                <Text style={incomingCardStyles.emptyBody}>
                  Hang tight ? this only takes a moment.
                </Text>
              </View>
            </View>
          ) : requests.length === 0 ? (
            <View style={incomingCardStyles.emptyCard}>
              <View style={incomingCardStyles.emptyIcon}>
                <Feather name="check" size={20} color={AUTH_COLORS.green} />
              </View>
              <View style={incomingCardStyles.emptyCopy}>
                <Text style={incomingCardStyles.emptyTitle}>All clear</Text>
                <Text style={incomingCardStyles.emptyBody}>
                  No pending consultation requests right now.
                </Text>
              </View>
            </View>
          ) : (
            requests.map((request) => {
              const statusStyle = getIncomingStatusStyle(request.status);
              const isCompleted = request.status === "completed";
              const patientName =
                request.patientId?.fullname || "Unknown Patient";
              const displayPatientName = isCompleted ? "Patient" : patientName;
              const displayInitials = isCompleted
                ? "P"
                : getPatientInitials(patientName);
              const patientPhone = canShowPatientPhone(request.status)
                ? request.patientId?.cellphoneNumber?.trim() || null
                : null;
              const ailmentName = getAilmentName(
                request.ailmentCategoryId || request.ailmentCategory,
              );
              const fee = `N$ ${request.consultationCost ?? request.estimatedCost ?? 0}`;
              const consultationMode: "house_visit" | "video_consultation" =
                request.consultationMode === "video_consultation"
                  ? "video_consultation"
                  : "house_visit";
              const consultationModeMeta =
                consultationMode === "video_consultation"
                  ? { label: "Video", icon: "video" as const }
                  : { label: "House visit", icon: "home" as const };
              const addressLine =
                !isCompleted && request.address
                  ? [
                      request.address.route,
                      request.address.locality,
                      request.address.administrative_area_level_1,
                    ]
                      .filter(Boolean)
                      .join(", ")
                  : null;
              const prescriptionReq = isPrescriptionRequest(request);

              return (
                <View
                  key={request._id}
                  style={[
                    appScreenStyles.requestCard,
                    incomingCardStyles.card,
                  ]}
                >
                  <TouchableOpacity
                    onPress={() => setSelectedRequest(request)}
                    activeOpacity={0.88}
                    style={incomingCardStyles.header}
                  >
                    <View style={incomingCardStyles.avatar}>
                      <Text style={incomingCardStyles.avatarText}>
                        {displayInitials}
                      </Text>
                    </View>

                    <View style={incomingCardStyles.headerMain}>
                      <Text
                        style={incomingCardStyles.patientName}
                        numberOfLines={1}
                      >
                        {displayPatientName}
                      </Text>
                      {patientPhone ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${patientPhone}`)}
                          style={incomingCardStyles.phoneRow}
                          hitSlop={8}
                          activeOpacity={0.7}
                        >
                          <Feather
                            name="phone"
                            size={12}
                            color={AUTH_COLORS.green}
                          />
                          <Text
                            style={incomingCardStyles.phoneText}
                            numberOfLines={1}
                          >
                            {patientPhone}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text
                        style={incomingCardStyles.ailmentLine}
                        numberOfLines={1}
                      >
                        {ailmentName}
                      </Text>
                    </View>

                    <View style={incomingCardStyles.statusPill}>
                      <Feather
                        name={statusStyle.icon}
                        size={11}
                        color={statusStyle.text}
                      />
                      <Text
                        style={incomingCardStyles.statusText}
                        numberOfLines={1}
                      >
                        {formatStatusLabel(request.status || "pending")}
                      </Text>
                    </View>
                  </TouchableOpacity>

                  <View style={incomingCardStyles.detailsPanel}>
                    <View style={incomingCardStyles.detailsRow}>
                      <View style={incomingCardStyles.detailItem}>
                        <Text style={incomingCardStyles.detailLabel}>Fee</Text>
                        <Text style={incomingCardStyles.detailValue}>{fee}</Text>
                      </View>
                      <View style={incomingCardStyles.detailDivider} />
                      <View style={incomingCardStyles.detailItem}>
                        <Text style={incomingCardStyles.detailLabel}>Date</Text>
                        <Text style={incomingCardStyles.detailValue}>
                          {formatIncomingDate(request.createdAt)}
                        </Text>
                      </View>
                    </View>

                    <View style={incomingCardStyles.modeRow}>
                      <Feather
                        name={consultationModeMeta.icon}
                        size={13}
                        color={AUTH_COLORS.greenDark}
                      />
                      <Text style={incomingCardStyles.modeLabel}>
                        {consultationModeMeta.label}
                      </Text>
                    </View>

                    {addressLine ? (
                      <View style={incomingCardStyles.locationRow}>
                        <Feather
                          name="map-pin"
                          size={14}
                          color={AUTH_COLORS.green}
                          style={{ marginTop: 2 }}
                        />
                        <Text style={incomingCardStyles.locationText}>
                          {addressLine}
                        </Text>
                      </View>
                    ) : null}

                    {request.symptoms ? (
                      <View style={incomingCardStyles.symptomsBlock}>
                        <Text style={incomingCardStyles.detailLabel}>
                          Symptoms
                        </Text>
                        <Text style={incomingCardStyles.symptomsText}>
                          {request.symptoms}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={incomingCardStyles.actionsRow}>
                    <TouchableOpacity
                      onPress={() => confirmDecline(request._id, patientName)}
                      style={incomingCardStyles.declineBtn}
                      activeOpacity={0.85}
                      disabled={!!actionLoading}
                    >
                      <Text style={incomingCardStyles.declineBtnText}>
                        Decline
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        if (prescriptionReq) {
                          handlePharmacistAccept(request);
                        } else {
                          confirmAccept(request);
                        }
                      }}
                      style={[
                        incomingCardStyles.acceptBtn,
                        actionLoading?.requestId === request._id &&
                        actionLoading.action === "accept"
                          ? { opacity: 0.7 }
                          : null,
                      ]}
                      activeOpacity={0.9}
                      disabled={!!actionLoading}
                    >
                      {actionLoading?.requestId === request._id &&
                      actionLoading.action === "accept" ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={incomingCardStyles.acceptBtnText}>
                          {prescriptionReq ? "Check" : "Accept"}
                        </Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {isOnline && requests.length > 0 && incomingHasMore ? (
            <TouchableOpacity
              onPress={loadMoreIncomingRequests}
              disabled={isLoadingMoreRequests}
              style={incomingCardStyles.loadMoreButton}
              activeOpacity={0.85}
            >
              {isLoadingMoreRequests ? (
                <ActivityIndicator size="small" color={AUTH_COLORS.green} />
              ) : (
                <>
                  <Feather name="chevron-down" size={16} color={AUTH_COLORS.green} />
                  <Text style={incomingCardStyles.loadMoreText}>
                    Load more
                    {incomingTotal > requests.length
                      ? ` (${requests.length} of ${incomingTotal})`
                      : ""}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
      </View>

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
                  {selectedRequest.status === "completed"
                    ? "Patient"
                    : selectedRequest.patientId?.fullname || "Unknown Patient"}
                </Text>
                {canShowPatientPhone(selectedRequest.status) &&
                selectedRequest.patientId?.cellphoneNumber ? (
                  <TouchableOpacity
                    onPress={() =>
                      Linking.openURL(
                        `tel:${selectedRequest.patientId.cellphoneNumber}`,
                      )
                    }
                    className="flex-row items-center mb-2"
                    activeOpacity={0.7}
                  >
                    <Feather name="phone" size={14} color={AUTH_COLORS.green} />
                    <Text
                      className="text-sm font-semibold ml-2"
                      style={{ color: AUTH_COLORS.greenDark }}
                    >
                      {selectedRequest.patientId.cellphoneNumber}
                    </Text>
                  </TouchableOpacity>
                ) : null}
                <View className="flex-row items-center mb-2">
                  <Feather name="alert-circle" size={14} color="#6B7280" />
                  <Text className="text-sm text-gray-600 ml-2">
                    {selectedRequest.ailmentCategory}
                  </Text>
                </View>
                <View
                  className="self-start mb-2 px-3 py-1.5 rounded-full border flex-row items-center"
                  style={{
                    backgroundColor: "#F0FDF4",
                    borderColor: AUTH_COLORS.inputBorder,
                  }}
                >
                  <Feather
                    name={
                      selectedRequest.consultationMode === "video_consultation"
                        ? "video"
                        : "home"
                    }
                    size={12}
                    color={AUTH_COLORS.greenDark}
                  />
                  <Text
                    className="text-xs font-bold ml-1.5"
                    style={{ color: AUTH_COLORS.greenDark }}
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
                {selectedRequest.status !== "completed" ? (
                  <View className="flex-row items-center mt-2">
                    <Feather name="map-pin" size={14} color="#6B7280" />
                    <Text className="text-sm text-gray-600 ml-2">
                      {selectedRequest.address?.locality || "Unknown location"}
                    </Text>
                  </View>
                ) : null}
              </View>

              {/* Fee Breakdown */}
              <View
                className="rounded-2xl p-4 mb-4"
                style={{
                  backgroundColor: AUTH_COLORS.bg,
                  borderWidth: 1,
                  borderColor: AUTH_COLORS.inputBorder,
                }}
              >
                <View className="flex-row justify-between items-center">
                  <Text
                    className="text-sm font-semibold"
                    style={{ color: AUTH_COLORS.textMuted }}
                  >
                    Consultation Fee
                  </Text>
                  <Text
                    className="text-base font-extrabold"
                    style={{ color: AUTH_COLORS.textDark }}
                  >
                    N$ {selectedRequest.consultationCost ?? selectedRequest.estimatedCost ?? 0}
                  </Text>
                </View>
              </View>

              {/* Map */}
              {(() => {
                if (selectedRequest.status === "completed") return null;

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

                    <View className="rounded-xl overflow-hidden h-48 bg-gray-100 border-2 border-[#BBF7D0]">
                      {showDetailMap ? (
                        <MapView
                          style={styles.map}
                          pointerEvents="auto"
                          scrollEnabled
                          zoomEnabled
                          rotateEnabled={false}
                          pitchEnabled={false}
                          provider={MAP_PROVIDER}
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
                        >
                          <Marker
                            coordinate={coords}
                            title={selectedRequest.patientId?.fullname}
                            description={selectedRequest.ailmentCategory}
                            pinColor={AUTH_COLORS.green}
                          />
                        </MapView>
                      ) : (
                        <View className="flex-1 items-center justify-center h-48">
                          <ActivityIndicator
                            size="small"
                            color={AUTH_COLORS.green}
                          />
                        </View>
                      )}
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
                  disabled={!!actionLoading}
                  className="flex-1 bg-gray-100 py-3.5 rounded-xl border-2 border-[#BBF7D0]"
                >
                  <Text className="text-gray-700 font-bold text-center">
                    Decline
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    if (isPrescriptionRequest(selectedRequest)) {
                      handlePharmacistAccept(selectedRequest);
                    } else {
                      confirmAccept(selectedRequest);
                    }
                  }}
                  disabled={!!actionLoading}
                  className="flex-1 py-3.5 rounded-xl items-center justify-center"
                  style={{
                    backgroundColor: AUTH_COLORS.green,
                    opacity: actionLoading?.requestId === selectedRequest._id ? 0.7 : 1,
                  }}
                >
                  {actionLoading?.requestId === selectedRequest._id &&
                  actionLoading.action === "accept" ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text className="text-white font-bold text-center">
                      {isPrescriptionRequest(selectedRequest)
                        ? "Check Prescription"
                        : "Accept Request"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <PostalAddressConfirmModal
        visible={showPostalAddressModal}
        onClose={() => {
          setShowPostalAddressModal(false);
          setPendingAcceptRequest(null);
        }}
        defaultAddressee={user?.fullname || ""}
        onConfirmed={handleProviderPostalConfirmed}
        title="Confirm Postal Address"
        bannerTitle="Confirm your postal address"
        bannerBody="Before accepting a medical aid consultation, confirm or update your Namibian postal address for the claim."
        confirmLabel="Confirm & Continue"
      />

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
                  <Text style={styles.linkText} className="text-sm font-semibold">
                    Skip
                  </Text>
                </TouchableOpacity>
              </View>
              <View className="w-full h-2 rounded-full" style={{ backgroundColor: "#E5E7EB" }}>
                <View
                  style={{
                    height: "100%",
                    backgroundColor: AUTH_COLORS.green,
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
                    source={require("../../../../assets/images/connectlogo.png")}
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
                className="flex-1 ml-2 p-4 rounded-lg"
                style={{ backgroundColor: AUTH_COLORS.green }}
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
    </ScreenLayout>
  );
}

const incomingCardStyles = StyleSheet.create({
  emptyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 16,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCopy: {
    flex: 1,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  emptyBody: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.textMuted,
  },
  loadMoreButton: {
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 14,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.greenDark,
  },
  card: {
    overflow: "hidden",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    padding: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: AUTH_COLORS.greenDark,
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  patientName: {
    fontSize: 17,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.2,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 4,
    alignSelf: "flex-start",
  },
  phoneText: {
    fontSize: 13,
    fontWeight: "700",
    color: AUTH_COLORS.greenDark,
  },
  ailmentLine: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginTop: 3,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 120,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: AUTH_COLORS.greenDark,
    textTransform: "capitalize",
  },
  detailsPanel: {
    backgroundColor: AUTH_COLORS.bg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    padding: 14,
    marginBottom: 14,
    gap: 12,
  },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailItem: {
    flex: 1,
  },
  detailDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#E5E7EB",
    marginHorizontal: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 16,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  modeLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.greenDark,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  locationText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    color: AUTH_COLORS.textMuted,
    fontWeight: "500",
  },
  symptomsBlock: {
    gap: 4,
  },
  symptomsText: {
    fontSize: 13,
    lineHeight: 18,
    color: AUTH_COLORS.textDark,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  declineBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: AUTH_COLORS.error,
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: AUTH_COLORS.green,
  },
  acceptBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: AUTH_COLORS.white,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  titleText: {
    color: AUTH_COLORS.textDark,
  },
  mutedText: {
    color: AUTH_COLORS.textMuted,
  },
  linkText: {
    color: AUTH_COLORS.green,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
});
