import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import ScreenLayout, { SCREEN_EDGES_STACK } from "../../../components/ScreenLayout";
import { AuthBackgroundDecor } from "../../../components/AuthScreenLayout";
import AilmentCard from "../../../components/(patient)/AilmentCard";
import CreateRequestModal from "../../../components/(patient)/CreateRequestModal";
import HistoryCard, {
  HistoryItem,
} from "../../../components/(patient)/HistoryCard";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../lib/api";
import {
  getCachedAilmentCategories,
  normalizeAilmentCategories,
  prefetchAilmentCategoryImages,
  setCachedAilmentCategories,
} from "../../../lib/ailmentCache";
import { buildBackendAssetUrl } from "../../../lib/backend";
import { getLocationCoordinates } from "../../../lib/geocoding";
import { ensureForegroundLocationPermission } from "../../../lib/locationPermission";
import { PrescriptionFile, uploadPrescription } from "../../../lib/prescription";
import socketService from "../../../lib/socket";
import { AUTH_COLORS } from "../../../lib/authScreenTheme";
import { appBottomSheetStyles, appModalBottomSheetStyles } from "../../../components/app/AppBottomSheetUI";

interface Advert {
  _id: string;
  description: string;
  image: string;
  createdAt: string;
  updatedAt: string;
}

type SectionHeaderProps = {
  icon: React.ComponentProps<typeof Feather>["name"];
  title: string;
  subtitle: string;
  onSeeAll?: () => void;
  /** Use neutral styling (no green) — for service sections */
  neutral?: boolean;
};

function SectionHeader({ icon, title, subtitle, onSeeAll, neutral }: SectionHeaderProps) {
  const iconColor = neutral ? AUTH_COLORS.textDark : AUTH_COLORS.green;
  const linkColor = neutral ? AUTH_COLORS.textDark : AUTH_COLORS.green;

  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View
          style={[
            styles.sectionIconWrap,
            neutral && styles.sectionIconWrapNeutral,
          ]}
        >
          <Feather name={icon} size={18} color={iconColor} />
        </View>
        <View style={styles.sectionHeaderText}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll} style={styles.seeAllBtn} activeOpacity={0.85}>
          <Text style={[styles.linkText, neutral && styles.linkTextNeutral]}>
            See all
          </Text>
          <Feather name="chevron-right" size={16} color={linkColor} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default function PatientHomeScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState<any>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [recentRequests, setRecentRequests] = useState<HistoryItem[]>([]);
  const [ailmentCategories, setAilmentCategories] = useState<any[]>([]);
  const [isLoadingAilments, setIsLoadingAilments] = useState(true);
  const ailmentsReadyRef = useRef(false);
  const [adverts, setAdverts] = useState<Advert[]>([]);
  const [isLoadingAdverts, setIsLoadingAdverts] = useState(false);
  const [selectedAdvert, setSelectedAdvert] = useState<Advert | null>(null);
  const [advertModalVisible, setAdvertModalVisible] = useState(false);
  const [currentAdvertIndex, setCurrentAdvertIndex] = useState(0);
  const [advertImageLoading, setAdvertImageLoading] = useState(true);
  const [advertImageError, setAdvertImageError] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const advertSlideAnim = React.useRef(new Animated.Value(0)).current;
  const [showWelcomeModal, setShowWelcomeModal] = useState(false);
  const [currentOnboardingStep, setCurrentOnboardingStep] = useState(0);

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
        "Request home visits from nearby healthcare providers, right from your phone.",
      icon: "heart-pulse",
      image: true,
    },
    {
      id: 2,
      title: "Choose Your Ailment",
      description:
        "Select what you need help with so we can match you to the right provider.",
      icon: "stethoscope",
    },
    {
      id: 3,
      title: "Share Your Location",
      description:
        "We use your location to find providers near you. You stay in control at all times.",
      icon: "map-marker",
    },
    {
      id: 4,
      title: "Track Your Requests",
      description:
        "See the status of your recent healthcare requests in one place.",
      icon: "clock-outline",
    },
  ];

  // First-time user welcome modal (patient)
  useEffect(() => {
    const checkFirstTime = async () => {
      try {
        const seen = await AsyncStorage.getItem("patient-onboarding-shown-v1");
        if (!seen) {
          setShowWelcomeModal(true);
        }
      } catch (e) {
        console.error("Error checking patient onboarding flag:", e);
      }
    };

    checkFirstTime();
  }, []);

  const handleWelcomeModalClose = async () => {
    try {
      await AsyncStorage.setItem("patient-onboarding-shown-v1", "true");
    } catch (e) {
      console.error("Error saving patient onboarding flag:", e);
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

  // Function to fetch adverts from API
  const loadAdverts = useCallback(async () => {
    setIsLoadingAdverts(true);
    try {
      const response = await apiClient.get("/app/adverts/all-adverts");
      if (
        response.data?.adverts &&
        Array.isArray(response.data.adverts) &&
        response.data.adverts.length > 0
      ) {
        setAdverts(response.data.adverts);

        // Prefetch all advert images for faster loading
        response.data.adverts.forEach((advert: Advert) => {
          const imageUri = buildBackendAssetUrl("adverts", advert.image);
          if (imageUri) {
            Image.prefetch(imageUri).catch((err) => {
              console.log("Failed to prefetch advert image:", imageUri, err);
            });
          }
        });
      } else {
        setAdverts([]);
      }
    } catch (error) {
      console.error("Error loading adverts:", error);
      setAdverts([]);
    } finally {
      setIsLoadingAdverts(false);
    }
  }, []);

  // Show cached ailments immediately, then refresh from the server in the background
  useEffect(() => {
    (async () => {
      const cached = await getCachedAilmentCategories();
      if (!cached?.length) return;

      const normalized = normalizeAilmentCategories(cached);
      setAilmentCategories(normalized);
      ailmentsReadyRef.current = true;
      setIsLoadingAilments(false);
      void prefetchAilmentCategoryImages(normalized, 6);
    })();
  }, []);

  const applyAilmentCategories = useCallback((categories: any[]) => {
    const normalized = normalizeAilmentCategories(categories);
    setAilmentCategories(normalized);
    ailmentsReadyRef.current = true;
    void setCachedAilmentCategories(normalized);
    void prefetchAilmentCategoryImages(normalized, 6);
  }, []);

  // Function to fetch ailment categories from backend via socket
  const loadAilmentCategories = useCallback(async () => {
    if (!ailmentsReadyRef.current) {
      setIsLoadingAilments(true);
    }
    try {
      // Wait for socket to be connected before proceeding
      console.log("⏳ Waiting for socket to connect...");
      await socketService.waitForConnection(10000);

      const socket = socketService.getSocket();
      if (!socket?.connected) {
        console.warn("⚠️ Socket not connected after waiting");
        setIsLoadingAilments(false);
        return;
      }

      console.log("✅ Socket is ready, fetching ailment categories");

      return new Promise<void>((resolve) => {
        let resolved = false;

        const handleAilmentCategories = (categories: any) => {
          if (resolved) return;
          resolved = true;

          console.log(
            "📋 Received ailment categories from backend:",
            categories,
          );
          if (Array.isArray(categories) && categories.length > 0) {
            applyAilmentCategories(categories);
          } else if (!ailmentsReadyRef.current) {
            setAilmentCategories([]);
          }
          socket?.off("ailmentCategories", handleAilmentCategories);
          setIsLoadingAilments(false);
          resolve();
        };

        const timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;

          console.warn("⚠️ Ailment categories request timeout");
          socket?.off("ailmentCategories", handleAilmentCategories);
          setIsLoadingAilments(false);
          resolve();
        }, 5000);

        socket?.on("ailmentCategories", handleAilmentCategories);
        console.log("📤 Emitting getAilmentCategories request");
        socket?.emit("getAilmentCategories");

        return () => clearTimeout(timeout);
      });
    } catch (error) {
      console.error("Error loading ailment categories:", error);
      setIsLoadingAilments(false);
    }
  }, [applyAilmentCategories]);

  // Function to load recent requests
  const loadRecentRequests = useCallback(async () => {
    try {
      // Fetch requests from backend via socket
      const socket = socketService.getSocket();
      if (!user?.userId || !socket || !socket.connected) {
        console.warn(
          "Socket not ready or user ID missing. Skipping recent requests load.",
        );
        setRecentRequests([]);
        return;
      }

      const liveRequests = await socketService.getPatientRequests(user.userId);
      console.log("🔍 Raw requests received:", liveRequests);

      if (Array.isArray(liveRequests) && liveRequests.length > 0) {
        console.log(
          "First request full structure:",
          JSON.stringify(liveRequests[0], null, 2),
        );
      }

      if (Array.isArray(liveRequests)) {
        // Load ailment mappings from local storage
        const ailmentMappingsStr = await AsyncStorage.getItem(
          `ailment-mappings-${user.userId}`,
        );
        const ailmentMappings = ailmentMappingsStr
          ? JSON.parse(ailmentMappingsStr)
          : {};
        console.log("📍 Ailment mappings:", ailmentMappings);

        // Get the 2 most recent requests
        const recent = liveRequests
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          )
          .slice(0, 2)
          .map((item: any) => {
            // Log each item's ailment structure
            console.log("Item ailmentCategoryId:", item.ailmentCategoryId);
            console.log(
              "Item ailmentCategoryId type:",
              typeof item.ailmentCategoryId,
            );

            // Try to get ailment name from backend data first
            let ailmentName = "Unknown";

            // First, try ailmentCategoryId.title (populated object)
            if (item.ailmentCategoryId?.title) {
              ailmentName = item.ailmentCategoryId.title;
            }
            // Try ailmentCategory field
            else if (item.ailmentCategory) {
              ailmentName = item.ailmentCategory;
            }
            // Try ailmentCategoryId.name (alternative field name)
            else if (item.ailmentCategoryId?.name) {
              ailmentName = item.ailmentCategoryId.name;
            }
            // Fall back to local mapping if available
            else if (ailmentMappings[item._id]) {
              ailmentName = ailmentMappings[item._id];
              console.log("✅ Got ailment from local mapping:", ailmentName);
            }

            console.log("Resolved ailment name:", ailmentName);

            return {
              _id: item._id,
              ailment: ailmentName,
              status: item.status,
              date: new Date(item.createdAt).toLocaleDateString("en-ZA", {
                year: "numeric",
                month: "short",
                day: "numeric",
              }),
            };
          });
        console.log("📋 Final recent requests:", recent);
        setRecentRequests(recent);
      }
    } catch (error) {
      console.error("Error loading recent requests:", error);
    }
  }, [user?.userId]);

  // Auto-scroll adverts with animation
  useEffect(() => {
    if (adverts.length > 0) {
      setAdvertImageLoading(true);
      setAdvertImageError(false);

      const currentAdvert = adverts[currentAdvertIndex];
      const imageUri = buildBackendAssetUrl("adverts", currentAdvert?.image);
      if (imageUri) {
        Image.prefetch(imageUri)
          .then(() => {
            setAdvertImageLoading(false);
          })
          .catch(() => {
            setAdvertImageError(true);
            setAdvertImageLoading(false);
          });
      }

      advertSlideAnim.setValue(0);
      Animated.timing(advertSlideAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [currentAdvertIndex, advertSlideAnim, adverts.length]);

  useEffect(() => {
    if (adverts.length > 0) {
      const interval = setInterval(() => {
        setCurrentAdvertIndex((prev) => (prev + 1) % adverts.length);
      }, 5000); // Change every 5 seconds

      return () => clearInterval(interval);
    }
  }, [adverts.length]);

  // Connect socket on mount and load ailment categories
  useEffect(() => {
    if (user?.userId) {
      try {
        // Connect with patient role
        socketService.connect(user.userId, "patient");

        // Load ailment categories (will wait for socket connection internally)
        loadAilmentCategories().catch((error) => {
          console.error("Error loading ailment categories:", error);
        });
      } catch (error) {
        console.error("Error connecting to socket:", error);
      }
    }
  }, [user?.userId, loadAilmentCategories]);

  // Load recent requests on mount and when screen comes into focus
  useEffect(() => {
    loadRecentRequests();
  }, [loadRecentRequests]);

  // Load adverts on mount
  useEffect(() => {
    loadAdverts();
  }, [loadAdverts]);

  useFocusEffect(
    useCallback(() => {
      loadAilmentCategories();
      loadRecentRequests();
      loadAdverts();
    }, [loadAilmentCategories, loadRecentRequests, loadAdverts]),
  );

  // Universal refresh function
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      // Refresh all data in parallel
      await Promise.all([
        loadAilmentCategories(),
        loadAdverts(),
        loadRecentRequests(),
      ]);
    } catch (error) {
      console.error("Error refreshing data:", error);
    } finally {
      setRefreshing(false);
    }
  }, [loadAilmentCategories, loadAdverts, loadRecentRequests]);

  // Use location if already granted; do not prompt on login (prompt when booking care)
  useEffect(() => {
    const defaultLocation = { latitude: -22.55784, longitude: 17.072891 };

    (async () => {
      try {
        const { granted } = await ensureForegroundLocationPermission({
          requestIfNeeded: false,
        });
        if (!granted) {
          setLocation(defaultLocation);
          return;
        }

        const coords = await getLocationCoordinates({ requestPermission: false });
        setLocation({
          latitude: coords.latitude,
          longitude: coords.longitude,
        });
        console.log("✅ Location obtained successfully:", coords);
      } catch (error: any) {
        console.error("Location error:", error);
        setLocation(defaultLocation);
      }
    })();
  }, []);

  const handleAilmentSelect = (ailment: any) => {
    setSelectedAilment(ailment);
    setModalVisible(true);
  };

  const handleCreateRequest = async (requestData: {
    ailmentCategory: string;
    ailmentCategoryId?: string;
    consultationMode: "house_visit" | "video_consultation";
    symptoms: string;
    paymentMethod: "wallet" | "cash";
    consultationCost: number;
    street: string;
    locality: string;
    region: string;
    preferredTime?: string;
    coordinates?: { latitude: number; longitude: number };
    prescriptionFile?: PrescriptionFile;
  }) => {
    // Use coordinates from the modal if provided, otherwise try to get current location
    let currentLocation = requestData.coordinates || location;

    if (!currentLocation) {
      try {
        const coords = await getLocationCoordinates({ requestPermission: true });
        currentLocation = coords;
        setLocation(coords);
      } catch {
        throw new Error(
          "Location is required to create a request. Please enable location services and try again.",
        );
      }
    }

    if (!user?.userId) {
      throw new Error("User not authenticated");
    }

    try {
      // Sanitize ailmentCategoryId: backend expects a MongoDB ObjectId (24 hex chars).
      // If the selected/default category uses a placeholder id (like '1'), omit it so the
      // socket service will use its safe fallback. This avoids Mongoose "Cast to ObjectId failed" errors.
      const safeAilmentCategoryId =
        requestData.ailmentCategoryId &&
        /^[0-9a-fA-F]{24}$/.test(requestData.ailmentCategoryId)
          ? requestData.ailmentCategoryId
          : undefined;

      const request = await socketService.createRequest({
        patientId: user.userId,
        location: currentLocation,
        ailmentCategory: requestData.ailmentCategory,
        ailmentCategoryId: safeAilmentCategoryId,
        consultationMode: requestData.consultationMode,
        paymentMethod: requestData.paymentMethod,
        symptoms: requestData.symptoms,
        consultationCost: requestData.consultationCost,
        address: {
          route: requestData.street,
          locality: requestData.locality,
          administrative_area_level_1: requestData.region,
          coordinates: {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          },
        },
        preferredTime: requestData.preferredTime,
      });

      const requestId = (request as any)?._id as string | undefined;

      if (requestData.prescriptionFile && requestId) {
        try {
          await uploadPrescription({
            requestId,
            file: requestData.prescriptionFile,
          });
        } catch (uploadError) {
          try {
            await socketService.cancelRequest(
              requestId,
              "patient",
              "Prescription upload failed",
            );
          } catch (cancelError) {
            console.warn(
              "Failed to cancel request after prescription upload error:",
              cancelError,
            );
          }
          throw uploadError;
        }
      }
      // Save ailment mapping locally for future reference (since backend stores null)
      if (requestId) {
        try {
          const ailmentMappingsStr = await AsyncStorage.getItem(
            `ailment-mappings-${user.userId}`,
          );
          const ailmentMappings = ailmentMappingsStr
            ? JSON.parse(ailmentMappingsStr)
            : {};
            
          ailmentMappings[requestId] = requestData.ailmentCategory;
          await AsyncStorage.setItem(
            `ailment-mappings-${user.userId}`,
            JSON.stringify(ailmentMappings),
          );
          console.log("💾 Saved ailment mapping:", ailmentMappings);
        } catch (storageError) {
          console.error("Error saving ailment mapping:", storageError);
        }
      }

      console.log("✅ Request created successfully:", request);
      console.log("🔄 Navigating to waiting room...");

      // Navigate to waiting room immediately after successful request creation
      // Use setTimeout to ensure modal closes first
      setTimeout(() => {
        try {
          console.log("🚀 Executing navigation to waiting room...");
          router.push("/(app)/(patient)/waiting-room");
          console.log("✅ Navigation to waiting room initiated");
        } catch (navError) {
          console.error("❌ Navigation error:", navError);
        }
      }, 100);

      // Refresh recent requests to show the newly created request
      loadRecentRequests();
    } catch (error: any) {
      console.log("❌ Request creation failed:", error);
      console.log("❌ Error details:", error.message, error.stack);
      throw new Error(error.message || "Failed to create request");
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();

    if (hour < 12) {
      return "Good morning";
    } else if (hour < 18) {
      return "Good afternoon";
    } else {
      return "Good evening";
    }
  };

  const getGreetingEmoji = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "🌤️";
    if (hour < 18) return "☀️";
    return "🌙";
  };

  const greeting = getGreeting();
  const firstName =
    user?.fullname?.trim().split(/\s+/)[0] || "there";

  return (
    <>
      <ScreenLayout edges={SCREEN_EDGES_STACK} backgroundColor={AUTH_COLORS.bg}>
        <View style={styles.screen}>
          <AuthBackgroundDecor />
          <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[AUTH_COLORS.green]}
                tintColor={AUTH_COLORS.green}
              />
            }
            contentContainerStyle={styles.scrollContent}
          >
            {/* Hero welcome card */}
            <View style={styles.heroCard}>
              <View style={styles.heroOrbLarge} pointerEvents="none" />
              <View style={styles.heroOrbSmall} pointerEvents="none" />
              <View style={styles.heroRow}>
                <View style={styles.heroTextBlock}>
                  <Text style={styles.heroEyebrow}>
                    {greeting} {getGreetingEmoji()}
                  </Text>
                  <Text style={styles.heroName}>{firstName}</Text>
                  <Text style={styles.heroTagline}>
                    Care that comes to you — book a visit in a few taps.
                  </Text>
                </View>
                <View style={styles.heroLogoWrap}>
                  <Image
                    source={require("../../../assets/images/connectlogo.png")}
                    style={styles.heroLogo}
                    resizeMode="contain"
                  />
                </View>
              </View>
              <View style={styles.heroStatsRow}>
                <View style={styles.statPill}>
                  <Feather name="clock" size={14} color={AUTH_COLORS.green} />
                  <Text style={styles.statPillText}>
                    {recentRequests.length} recent
                  </Text>
                </View>
                <View style={styles.statPill}>
                  <Feather name="heart" size={14} color={AUTH_COLORS.green} />
                  <Text style={styles.statPillText}>
                    {ailmentCategories.length || "—"} services
                  </Text>
                </View>
              </View>
            </View>

            {/* Quick actions */}
            <View style={styles.quickActionsRow}>
              <TouchableOpacity
                style={styles.quickAction}
                activeOpacity={0.88}
                onPress={() => router.push("/(app)/(patient)/all_ailments")}
              >
                <View style={[styles.quickActionIcon, styles.quickActionIconPrimary]}>
                  <Feather name="grid" size={20} color={AUTH_COLORS.white} />
                </View>
                <Text style={styles.quickActionLabel}>Browse care</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                activeOpacity={0.88}
                onPress={() =>
                  router.push("/(app)/(patient)/recent-activities")
                }
              >
                <View style={styles.quickActionIcon}>
                  <Feather name="activity" size={20} color={AUTH_COLORS.green} />
                </View>
                <Text style={styles.quickActionLabel}>My activity</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickAction}
                activeOpacity={0.88}
                onPress={() => router.push("/(app)/(patient)/profile")}
              >
                <View style={styles.quickActionIcon}>
                  <Feather name="user" size={20} color={AUTH_COLORS.green} />
                </View>
                <Text style={styles.quickActionLabel}>Profile</Text>
              </TouchableOpacity>
            </View>

            {/* Adverts or Health Tips Section */}
            {adverts.length > 0 ? (
              <View style={styles.spotlightSection}>
                <View style={styles.spotlightBadge}>
                  <Feather name="star" size={12} color={AUTH_COLORS.white} />
                  <Text style={styles.spotlightBadgeText}>Spotlight</Text>
                </View>
                <Animated.View
                  style={{
                    opacity: advertSlideAnim,
                    transform: [
                      {
                        translateX: advertSlideAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [40, 0],
                        }),
                      },
                    ],
                  }}
                >
                  <TouchableOpacity
                    onPress={() => {
                      setSelectedAdvert(adverts[currentAdvertIndex]);
                      setAdvertModalVisible(true);
                    }}
                    activeOpacity={0.92}
                    style={styles.advertContainer}
                  >
                    {advertImageLoading && (
                      <View
                        style={{
                          position: "absolute",
                          width: "100%",
                          height: "100%",
                          backgroundColor: AUTH_COLORS.bg,
                          justifyContent: "center",
                          alignItems: "center",
                          zIndex: 1,
                        }}
                      >
                        <ActivityIndicator size="small" color={AUTH_COLORS.green} />
                      </View>
                    )}
                    {!advertImageError &&
                      adverts[currentAdvertIndex]?.image && (
                        <Image
                          source={{
                            uri:
                              buildBackendAssetUrl(
                                "adverts",
                                adverts[currentAdvertIndex].image,
                              ) || undefined,
                          }}
                          style={styles.advertImage}
                          resizeMode="contain"
                          onLoadStart={() => setAdvertImageLoading(true)}
                          onLoadEnd={() => setAdvertImageLoading(false)}
                          onError={() => {
                            setAdvertImageError(true);
                            setAdvertImageLoading(false);
                          }}
                        />
                      )}
                    {advertImageError && (
                      <View
                        style={{
                          width: "100%",
                          height: "100%",
                          backgroundColor: AUTH_COLORS.bg,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <Feather name="image" size={32} color="#9CA3AF" />
                      </View>
                    )}
                  </TouchableOpacity>
                </Animated.View>

                {/* Advert Indicators */}
                <View className="flex-row justify-center mt-4 gap-2">
                  {adverts.map((_, index) => (
                    <TouchableOpacity
                      key={index}
                      onPress={() => setCurrentAdvertIndex(index)}
                      className={`rounded-full transition-all ${
                        index === currentAdvertIndex
                          ? "bg-[#16A34A] w-3 h-3"
                          : "bg-[#BBF7D0] w-2 h-2"
                      }`}
                    />
                  ))}
                </View>
              </View>
            ) : null}

            {/* Ailments */}
            <View style={styles.contentSection}>
              <SectionHeader
                icon="plus-circle"
                title="Book care"
                subtitle="Pick a service to get started"
                neutral
                onSeeAll={() => router.push("/(app)/(patient)/all_ailments")}
              />

              {isLoadingAilments ? (
                <View style={styles.loadingCard}>
                  <ActivityIndicator size="small" color={AUTH_COLORS.textMuted} />
                  <Text style={styles.mutedText}>Finding available services…</Text>
                </View>
              ) : ailmentCategories.length > 0 ? (
                <FlatList
                  data={ailmentCategories.slice(0, 6)}
                  keyExtractor={(item) => item._id}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={styles.ailmentRow}
                  renderItem={({ item }) => (
                    <AilmentCard
                      item={item}
                      onPress={() => handleAilmentSelect(item)}
                    />
                  )}
                />
              ) : (
                <View style={styles.loadingCard}>
                  <Feather name="inbox" size={28} color={AUTH_COLORS.textMuted} />
                  <Text style={styles.mutedText}>No services available right now</Text>
                </View>
              )}
            </View>

            {/* Recent Activity */}
            <View style={styles.contentSection}>
              <SectionHeader
                icon="clock"
                title="Recent activity"
                subtitle="Your latest consultation requests"
                onSeeAll={() =>
                  router.push("/(app)/(patient)/recent-activities")
                }
              />

              {recentRequests.length === 0 ? (
                <View style={styles.emptyCard}>
                  <View style={styles.emptyIconWrap}>
                    <Feather name="clock" size={32} color={AUTH_COLORS.green} />
                  </View>
                  <Text style={styles.emptyTitle}>Nothing here yet</Text>
                  <Text style={styles.emptyBody}>
                    When you book care, your requests will show up here.
                  </Text>
                  <TouchableOpacity
                    style={styles.emptyCta}
                    onPress={() => router.push("/(app)/(patient)/all_ailments")}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.emptyCtaText}>Explore services</Text>
                    <Feather name="arrow-right" size={16} color={AUTH_COLORS.white} />
                  </TouchableOpacity>
                </View>
              ) : (
                <FlatList
                  data={recentRequests}
                  keyExtractor={(item) => item._id}
                  numColumns={2}
                  scrollEnabled={false}
                  columnWrapperStyle={styles.ailmentRow}
                  renderItem={({ item }) => <HistoryCard item={item} />}
                />
              )}
            </View>
          </ScrollView>

          {/* Create Request Modal */}
          <CreateRequestModal
            visible={modalVisible}
            onClose={() => {
              setModalVisible(false);
              setSelectedAilment(null);
            }}
            onSubmit={handleCreateRequest}
            selectedAilment={selectedAilment}
          />

          {/* Advert Detail Modal */}
          <Modal
            visible={advertModalVisible}
            animationType="fade"
            transparent={true}
            onRequestClose={() => {
              setAdvertModalVisible(false);
              setSelectedAdvert(null);
            }}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                {selectedAdvert && (
                  <>
                    <Image
                      source={{
                        uri:
                          buildBackendAssetUrl(
                            "adverts",
                            selectedAdvert.image,
                          ) || undefined,
                      }}
                      style={styles.modalImage}
                      resizeMode="contain"
                    />
                    <ScrollView
                      style={styles.modalDescriptionContainer}
                      contentContainerStyle={styles.modalDescriptionContent}
                      showsVerticalScrollIndicator={true}
                    >
                      <Text style={styles.modalDescription}>
                        {selectedAdvert.description}
                      </Text>
                    </ScrollView>
                    <TouchableOpacity
                      onPress={() => {
                        setAdvertModalVisible(false);
                        setSelectedAdvert(null);
                      }}
                      style={[
                        appBottomSheetStyles.primaryCta,
                        styles.modalCancelButton,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text style={appBottomSheetStyles.primaryCtaText}>Close</Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>
            </View>
          </Modal>
        </View>
      </ScreenLayout>

      {/* First-time user welcome modal (patient) */}
      <Modal visible={showWelcomeModal} animationType="slide" transparent>
        <View style={appModalBottomSheetStyles.overlay}>
          <View
            style={[
              appModalBottomSheetStyles.sheet,
              styles.welcomeSheet,
            ]}
          >
            <View style={appModalBottomSheetStyles.handle} />
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
                    source={require("../../../assets/images/connectlogo.png")}
                    style={{ width: "100%", height: "100%" }}
                    resizeMode="contain"
                  />
                </View>
              ) : (
                <View
                  className="w-24 h-24 rounded-full justify-center items-center mb-6"
                  style={{ backgroundColor: AUTH_COLORS.greenSoft }}
                >
                  <MaterialCommunityIcons
                    name={onboardingSteps[currentOnboardingStep].icon}
                    size={48}
                    color={AUTH_COLORS.green}
                  />
                </View>
              )}

              <Text style={styles.sectionTitle} className="text-2xl font-bold text-center mb-4">
                {onboardingSteps[currentOnboardingStep].title}
              </Text>
              <Text style={styles.mutedText} className="text-base text-center mb-8 px-4 leading-6">
                {onboardingSteps[currentOnboardingStep].description}
              </Text>
            </View>

            {/* Navigation */}
            <View className="flex-row justify-between items-center">
              <TouchableOpacity
                onPress={handleOnboardingPrevious}
                className={`flex-1 mr-2 p-4 rounded-lg border-2 ${
                  currentOnboardingStep === 0 ? "opacity-50" : ""
                }`}
                style={{ borderColor: AUTH_COLORS.inputBorder }}
                disabled={currentOnboardingStep === 0}
              >
                <Text style={styles.mutedText} className="text-center font-semibold">
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
                      ? "bg-[#16A34A]"
                      : "bg-[#BBF7D0]"
                  }`}
                />
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  heroCard: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 20,
    overflow: "hidden",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 6,
  },
  heroOrbLarge: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  heroOrbSmall: {
    position: "absolute",
    bottom: -20,
    left: -10,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(134, 239, 172, 0.3)",
  },
  heroRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  heroTextBlock: {
    flex: 1,
    paddingRight: 12,
  },
  heroEyebrow: {
    fontSize: 14,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    marginBottom: 4,
  },
  heroName: {
    fontSize: 28,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  heroTagline: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
  },
  heroLogoWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  heroLogo: {
    width: 48,
    height: 48,
  },
  heroStatsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 16,
  },
  statPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(187, 247, 208, 0.45)",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  statPillText: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  quickActionsRow: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    marginBottom: 24,
  },
  quickAction: {
    flex: 1,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 2,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  quickActionIconPrimary: {
    backgroundColor: AUTH_COLORS.green,
  },
  quickActionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    textAlign: "center",
  },
  spotlightSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    position: "relative",
  },
  spotlightBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: AUTH_COLORS.green,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  spotlightBadgeText: {
    color: AUTH_COLORS.white,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  contentSection: {
    paddingHorizontal: 20,
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 8,
  },
  sectionHeaderLeft: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  sectionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  sectionIconWrapNeutral: {
    backgroundColor: AUTH_COLORS.white,
  },
  sectionHeaderText: {
    flex: 1,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  ailmentRow: {
    justifyContent: "space-between",
  },
  loadingCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 28,
    alignItems: "center",
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  linkText: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.green,
  },
  linkTextNeutral: {
    color: AUTH_COLORS.textDark,
  },
  mutedText: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
  },
  emptyCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 28,
    alignItems: "center",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 3,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AUTH_COLORS.greenSoft,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: AUTH_COLORS.green,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
  },
  emptyCtaText: {
    color: AUTH_COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  advertContainer: {
    width: "100%",
    height: 180,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 5,
  },
  advertImage: {
    width: "100%",
    height: "100%",
  },
  modalOverlay: appModalBottomSheetStyles.overlayCenter,
  modalContent: appModalBottomSheetStyles.centeredCard,
  welcomeSheet: {
    height: "65%",
    width: "100%",
    padding: 24,
  },
  modalImage: {
    width: "100%",
    height: 300,
    borderRadius: 12,
    marginBottom: 16,
  },
  modalDescriptionContainer: {
    width: "100%",
    maxHeight: 200,
    marginBottom: 20,
  },
  modalDescriptionContent: {
    paddingHorizontal: 4,
  },
  modalDescription: {
    fontSize: 16,
    color: AUTH_COLORS.textMuted,
    lineHeight: 24,
    textAlign: "center",
  },
  modalCancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 32,
    minWidth: 120,
  },
});
