import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AppTextInput as TextInput } from "../../../components/AppTextInput";
import {
  HeaderBackButton,
  iosCustomTopBarRowStyle,
  iosCustomTopBarStyle,
} from "../../../components/HeaderBackButton";
import ScreenLayout, { SCREEN_EDGES_STACK } from "../../../components/ScreenLayout";
import CreateRequestModal from "../../../components/(patient)/CreateRequestModal";
import { useAuth } from "../../../context/AuthContext";
import {
  getCachedAilmentCategories,
  normalizeAilmentCategories,
  prefetchAilmentCategoryImages,
  setCachedAilmentCategories,
} from "../../../lib/ailmentCache";
import { iosInputIconSize, withIosTextInputStyle } from "../../../lib/iosInputStyles";
import { PrescriptionFile, uploadPrescription } from "../../../lib/prescription";
import socketService from "../../../lib/socket";

interface Ailment {
  _id: string;
  title: string;
  provider: string;
  supportsTeleconsultation?: boolean;
  physicalconsultationCost?: number;
  teleconsultationCost?: number | null;
  description?: string;
  linkedSpecializations?: string[];
}

const AilmentCard = ({
  item,
  onPress,
}: {
  item: Ailment;
  onPress: () => void;
}) => (
  <TouchableOpacity
    onPress={onPress}
    className="w-[48%] bg-white rounded-lg p-4 mb-4 border-2 border-gray-200"
  >
    <Feather name="alert-circle" size={24} color="#2563EB" />
    <Text className="text-base font-bold text-gray-800 mt-3">{item.title}</Text>
    <Text className="text-sm text-gray-600 mt-1">{item.provider}</Text>
  </TouchableOpacity>
);

export default function AilmentsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedAilment, setSelectedAilment] = useState("");
  const [location, setLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [ailments, setAilments] = useState<Ailment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const ailmentsReadyRef = useRef(false);

  useEffect(() => {
    (async () => {
      const cached = await getCachedAilmentCategories();
      if (!cached?.length) return;
      const normalized = normalizeAilmentCategories(cached) as Ailment[];
      setAilments(normalized);
      ailmentsReadyRef.current = true;
      setIsLoading(false);
      void prefetchAilmentCategoryImages(normalized, normalized.length);
    })();
  }, []);

  const applyAilmentCategories = useCallback((categories: any[]) => {
    const normalized = normalizeAilmentCategories(categories) as Ailment[];
    setAilments(normalized);
    ailmentsReadyRef.current = true;
    void setCachedAilmentCategories(normalized);
    void prefetchAilmentCategoryImages(normalized, normalized.length);
  }, []);

  const fetchAilments = useCallback(async () => {
    if (!ailmentsReadyRef.current) {
      setIsLoading(true);
    }
    try {
      await socketService.waitForConnection(10000);
      const socket = socketService.getSocket();
      if (!socket?.connected) {
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
          socket?.off("ailmentCategories", handleAilmentCategories);
          setIsLoading(false);
          resolve();
        }, 5000);

        socket?.on("ailmentCategories", handleAilmentCategories);
        socket?.emit("getAilmentCategories");
        return () => clearTimeout(timeout);
      });
    } catch {
      setIsLoading(false);
    }
  }, [applyAilmentCategories]);

  useFocusEffect(
    useCallback(() => {
      fetchAilments();
    }, [fetchAilments]),
  );

  const filteredAilments = ailments
    .filter(
      (ailment) =>
        ailment.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        ailment.provider?.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => a.title.localeCompare(b.title));

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
    let currentLocation = requestData.coordinates || location;

    if (!currentLocation) {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      currentLocation = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(currentLocation);
    }

    if (!user?.userId) {
      throw new Error("User not authenticated");
    }

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

    const requestId = (request as { _id?: string })?._id;
    if (requestData.prescriptionFile && requestId) {
      await uploadPrescription({ requestId, file: requestData.prescriptionFile });
    }

    setTimeout(() => {
      router.push("/(app)/(patient)/waiting-room");
    }, 100);
  };

  const showFullScreenLoader = isLoading && ailments.length === 0;

  return (
    <ScreenLayout
      edges={SCREEN_EDGES_STACK}
      backgroundColor="#F9FAFB"
      keyboard
    >
      <View style={styles.headerSection}>
        <View style={[styles.topBar, iosCustomTopBarStyle]}>
          <View style={[styles.topBarRow, iosCustomTopBarRowStyle]}>
            <HeaderBackButton color="#1F2937" size={24} />
            <Text className="text-2xl font-bold text-gray-800 ml-2">
              All Ailments
            </Text>
          </View>
        </View>

        <View style={styles.searchRow}>
          <Feather name="search" size={iosInputIconSize} color="#6B7280" />
          <TextInput
            placeholder="Search ailments or providers"
            className="flex-1 ml-3 text-base"
            style={withIosTextInputStyle(styles.searchInput)}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {showFullScreenLoader ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text className="mt-4 text-gray-600">Loading ailments...</Text>
        </View>
      ) : filteredAilments.length === 0 ? (
        <View style={styles.centered}>
          <Feather name="search" size={40} color="#9CA3AF" />
          <Text className="text-gray-600 mt-3 text-center px-6">
            No ailments found matching &quot;{searchQuery}&quot;
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.flex}
          data={filteredAilments}
          keyExtractor={(item) => item._id}
          numColumns={2}
          contentContainerStyle={styles.listContent}
          columnWrapperStyle={styles.columnWrapper}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => (
            <AilmentCard
              item={item}
              onPress={() => {
                setSelectedAilment(item);
                setModalVisible(true);
              }}
            />
          )}
        />
      )}

      <CreateRequestModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedAilment("");
        }}
        onSubmit={handleCreateRequest}
        selectedAilment={selectedAilment}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerSection: {
    paddingBottom: 8,
    backgroundColor: "#F9FAFB",
  },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
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
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
  },
  columnWrapper: {
    justifyContent: "space-between",
  },
});
