import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { Stack, useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { HeaderBackButton } from "../../../components/HeaderBackButton";
import ScreenLayout, { SCREEN_EDGES_STACK } from "../../../components/ScreenLayout";
import AilmentCard from "../../../components/(patient)/AilmentCard";
import { AppTextInput as TextInput } from "../../../components/AppTextInput";
import CreateRequestModal from "../../../components/(patient)/CreateRequestModal";
import { useAuth } from "../../../context/AuthContext";
import {
  clearAilmentCategoriesCache,
  getCachedAilmentCategories,
  normalizeAilmentCategories,
  prefetchAilmentCategoryImages,
  setCachedAilmentCategories,
} from "../../../lib/ailmentCache";
import { iosInputIconSize, withIosTextInputStyle } from "../../../lib/iosInputStyles";
import { alertConsultationSubmitted } from "../../../lib/consultationAlert";
import { PrescriptionFile, uploadPrescription } from "../../../lib/prescription";
import socketService from "../../../lib/socket";

interface Ailment {
  _id: string;
  title: string;
  provider?: string;
  supportsTeleconsultation?: boolean;
  physicalconsultationCost?: number;
  teleconsultationCost?: number | null;
  description?: string;
  linkedSpecializations?: string[];
  image?: string;
  specialization?: Array<{
    _id: string;
    title: string;
    role: string;
    description?: string;
  }>;
}

export default function AllAilmentsScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState<any>(null);
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [ailments, setAilments] = useState<Ailment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const ailmentsReadyRef = useRef(false);

  // Show cached ailments immediately, then refresh from the server in the background
  useEffect(() => {
    (async () => {
      const cached = await getCachedAilmentCategories();
      if (!cached?.length) return;

      const normalized = normalizeAilmentCategories(cached) as Ailment[];
      setAilments(normalized);
      ailmentsReadyRef.current = true;
      setIsLoading(false);
      void prefetchAilmentCategoryImages(normalized, 12);
    })();
  }, []);

  const applyAilmentCategories = useCallback((categories: any[]) => {
    const normalized = normalizeAilmentCategories(categories) as Ailment[];
    setAilments(normalized);
    ailmentsReadyRef.current = true;
    void setCachedAilmentCategories(normalized);
    void prefetchAilmentCategoryImages(normalized, 12);
  }, []);

  const fetchAilments = useCallback(async () => {
    if (!ailmentsReadyRef.current) {
      setIsLoading(true);
    }
    try {
      await socketService.waitForConnection(10000);

      const socket = socketService.getSocket();
      if (!socket?.connected) {
        console.warn("⚠️ Socket not connected after waiting");
        setIsLoading(false);
        return;
      }

      return new Promise<void>((resolve) => {
        let resolved = false;

        const handleAilmentCategories = (categories: any) => {
          if (resolved) return;
          resolved = true;

          if (Array.isArray(categories) && categories.length > 0) {
            applyAilmentCategories(categories);
          } else if (!ailmentsReadyRef.current) {
            setAilments([]);
          }
          socket?.off("ailmentCategories", handleAilmentCategories);
          setIsLoading(false);
          resolve();
        };

        const timeout = setTimeout(() => {
          if (resolved) return;
          resolved = true;

          console.warn("⚠️ Ailment categories request timeout");
          socket?.off("ailmentCategories", handleAilmentCategories);
          setIsLoading(false);
          resolve();
        }, 5000);

        socket?.on("ailmentCategories", handleAilmentCategories);
        socket?.emit("getAilmentCategories");

        return () => clearTimeout(timeout);
      });
    } catch (error) {
      console.error("Error loading ailment categories:", error);
      setIsLoading(false);
    }
  }, [applyAilmentCategories]);

  useEffect(() => {
    if (user?.userId) {
      socketService.connect(user.userId, "patient");
    }
  }, [user?.userId]);

  useEffect(() => {
    const handleCatalogUpdated = () => {
      void clearAilmentCategoriesCache().then(() => fetchAilments());
    };
    socketService.on("catalogUpdated", handleCatalogUpdated);
    return () => {
      socketService.off("catalogUpdated", handleCatalogUpdated);
    };
  }, [fetchAilments]);

  useFocusEffect(
    useCallback(() => {
      fetchAilments();
    }, [fetchAilments]),
  );

  const filteredAilments = ailments
    .filter(
      (ailment: Ailment) =>
        ailment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ailment.provider?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a: Ailment, b: Ailment) => a.title.localeCompare(b.title));

  const handleAilmentSelect = (ailment: Ailment) => {
    setSelectedAilment(ailment);
    setModalVisible(true);
  };

  const handleCreateRequest = async (requestData: {
    ailmentCategory: string;
    ailmentCategoryId?: string;
    consultationMode: "house_visit" | "video_consultation";
    symptoms: string;
    paymentMethod: "wallet" | "cash" | "medical_aid";
    consultationCost: number;
    street: string;
    locality: string;
    region: string;
    preferredTime?: string;
    coordinates?: { latitude: number; longitude: number };
    prescriptionFile?: PrescriptionFile;
    medicalAidDetails?: {
      medicalAidId: string;
      medicalAidTitle?: string;
      membershipNumber: string;
      mainMemberName: string;
      mainMemberId: string;
      residentialAddress: string;
    };
  }) => {
    let currentLocation = requestData.coordinates || location;

    if (!currentLocation) {
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        currentLocation = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setLocation(currentLocation);
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
        medicalAidDetails: requestData.medicalAidDetails,
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

      void alertConsultationSubmitted(requestId);

      setTimeout(() => {
        router.push("/(app)/(patient)/waiting-room");
      }, 100);
    } catch (error: any) {
      throw new Error(error.message || "Failed to create request");
    }
  };

  const showFullScreenLoader = isLoading && ailments.length === 0;
  const showEmptySearch =
    !showFullScreenLoader && ailments.length > 0 && filteredAilments.length === 0;
  const showNoAilments =
    !showFullScreenLoader &&
    ailments.length === 0 &&
    filteredAilments.length === 0;
  const showAilmentGrid = !showFullScreenLoader && !showEmptySearch && !showNoAilments;

  return (
    <ScreenLayout
      style={styles.screen}
      edges={SCREEN_EDGES_STACK}
      backgroundColor="#F9FAFB"
      keyboard
    >
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: false,
          headerStyle: { backgroundColor: "#F9FAFB" },
          title: "",
          headerLeft: () => <HeaderBackButton size={30} />,
        }}
      />
        <View style={styles.flex}>
          <View style={styles.searchSection}>
            <View style={styles.searchRow}>
              <Feather name="search" size={iosInputIconSize} color="#6B7280" />
              <TextInput
                placeholder="Search services ..."
                className="flex-1 ml-3 text-base"
                style={withIosTextInputStyle(styles.searchInput)}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
          </View>

          {showFullScreenLoader ? (
            <View style={styles.centeredContent}>
              <ActivityIndicator size="large" color="#2563EB" />
              <Text style={styles.loaderText}>Loading ailments...</Text>
            </View>
          ) : showEmptySearch ? (
            <View style={styles.centeredContent}>
              <Feather name="search" size={40} color="#9CA3AF" />
              <Text style={styles.emptyText}>
                No ailments found matching &quot;{searchQuery}&quot;
              </Text>
            </View>
          ) : showNoAilments ? (
            <View style={styles.centeredContent}>
              <Text style={styles.emptyText}>No ailments available</Text>
            </View>
          ) : showAilmentGrid ? (
            <FlatList
              data={filteredAilments}
              keyExtractor={(item) => item._id}
              numColumns={2}
              style={styles.flex}
              contentContainerStyle={styles.scrollContent}
              columnWrapperStyle={styles.grid}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              initialNumToRender={8}
              maxToRenderPerBatch={8}
              windowSize={7}
              removeClippedSubviews
              renderItem={({ item }) => (
                <AilmentCard
                  item={item}
                  onPress={() => handleAilmentSelect(item)}
                />
              )}
            />
          ) : null}
        </View>

      <CreateRequestModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedAilment(null);
        }}
        onSubmit={handleCreateRequest}
        selectedAilment={selectedAilment}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  flex: {
    flex: 1,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: "#F9FAFB",
    zIndex: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    ...(Platform.OS === "ios"
      ? { minHeight: 48, paddingVertical: 8 }
      : { paddingVertical: 10 }),
  },
  searchInput: {
    flex: 1,
  },
  centeredContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loaderText: {
    marginTop: 16,
    color: "#4B5563",
    fontSize: 16,
  },
  emptyText: {
    marginTop: 12,
    color: "#4B5563",
    fontSize: 16,
    textAlign: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    flexGrow: 1,
  },
  grid: {
    justifyContent: "space-between",
  },
});
