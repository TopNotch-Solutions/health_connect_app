import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import HistoryCard, {
  HistoryItem,
} from "../../../components/(patient)/HistoryCard";
import ScreenLayout, { SCREEN_EDGES_STACK } from "../../../components/ScreenLayout";
import { useAuth } from "../../../context/AuthContext";
import { AUTH_COLORS } from "../../../lib/authScreenTheme";
import socketService from "../../../lib/socket";

interface RequestStatus {
  _id: string;
  status:
    | "searching"
    | "pending"
    | "accepted"
    | "payment_pending"
    | "paid"
    | "provider_confirmation_pending"
    | "ready_for_call"
    | "in_call"
    | "en_route"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "expired"
    | "rejected";
  urgency: "low" | "medium" | "high" | "emergency";
  createdAt: string;
  consultationMode?: "house_visit" | "video_consultation";
  paymentMethod?: "wallet" | "cash";
  symptoms?: string;
  consultationCost?: number;
  estimatedCost?: number;
  ailmentCategoryId?: {
    _id: string;
    title: string;
  };
  providerId?: {
    _id: string;
    fullname: string;
    cellphoneNumber: string;
    role: string;
    walletID: string;
  };
  patientId?: {
    _id: string;
    fullname: string;
    walletID: string;
  };
  providerResponse?: {
    responseTime: string;
    estimatedArrival: string;
  };
  address?: {
    route: string;
    locality: string;
    administrative_area_level_1: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
}

interface StoredRequest {
  request: RequestStatus;
  acceptedAt: number;
}

const toHistoryItem = (stored: StoredRequest): HistoryItem => {
  const request = stored.request;
  return {
    _id: request._id,
    ailment: request.ailmentCategoryId?.title || "Healthcare Request",
    status: request.status,
    date: new Date(request.createdAt).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }),
    createdAt: request.createdAt,
    consultationMode: request.consultationMode,
    paymentMethod: request.paymentMethod,
    urgency: request.urgency,
    symptoms: request.symptoms,
    consultationCost:
      typeof request.consultationCost === "number"
        ? request.consultationCost
        : typeof request.estimatedCost === "number"
          ? request.estimatedCost
          : undefined,
    providerName: request.providerId?.fullname,
    providerRole: request.providerId?.role,
    providerPhone: request.providerId?.cellphoneNumber,
    estimatedArrival: request.providerResponse?.estimatedArrival,
    address: request.address
      ? {
          route: request.address.route,
          locality: request.address.locality,
          region: request.address.administrative_area_level_1,
        }
      : undefined,
  };
};

export default function RecentActivities() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StoredRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      // Get stored requests from AsyncStorage
      const storedData = await AsyncStorage.getItem(
        `waiting-room-${user?.userId}`,
      );
      let storedRequests: StoredRequest[] = storedData
        ? JSON.parse(storedData)
        : [];

      // Also fetch live requests from socket
      if (user?.userId && socketService.getSocket()?.connected) {
        try {
          const liveRequests = await socketService.getPatientRequests(
            user.userId,
          );
          if (Array.isArray(liveRequests)) {
            // Merge live requests with stored ones, prioritizing live data
            const mergedRequests = new Map<string, StoredRequest>();

            // Add stored requests first
            storedRequests.forEach((item) => {
              mergedRequests.set(item.request._id, item);
            });

            // Override with live requests
            liveRequests.forEach((req: RequestStatus) => {
              const stored = mergedRequests.get(req._id);
              const now = Date.now();
              const acceptedAt =
                ["accepted", "payment_pending"].includes(req.status) && !stored
                  ? now
                  : stored?.acceptedAt || now;
              mergedRequests.set(req._id, { request: req, acceptedAt });
            });

            const merged = Array.from(mergedRequests.values());
            setRequests(merged);

            // Save updated requests to storage
            await AsyncStorage.setItem(
              `waiting-room-${user?.userId}`,
              JSON.stringify(merged),
            );
          } else {
            setRequests(storedRequests);
          }
        } catch (error) {
          console.log("Could not fetch live requests, using stored:", error);
          setRequests(storedRequests);
        }
      } else {
        setRequests(storedRequests);
      }
    } catch (error) {
      console.error("Error loading requests:", error);
      setRequests([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.userId]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadRequests();
  }, [loadRequests]);

  const historyItems = useMemo(
    () =>
      [...requests]
        .sort(
          (a, b) =>
            new Date(b.request.createdAt).getTime() -
            new Date(a.request.createdAt).getTime(),
        )
        .map(toHistoryItem),
    [requests],
  );

  if (isLoading) {
    return (
      <ScreenLayout edges={SCREEN_EDGES_STACK} backgroundColor={AUTH_COLORS.bg}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AUTH_COLORS.green} />
          <Text style={styles.loadingText}>Loading your activities...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout edges={SCREEN_EDGES_STACK} backgroundColor={AUTH_COLORS.bg}>
      <FlatList
        data={historyItems}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => <HistoryCard item={item} />}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Recent activity</Text>
            <Text style={styles.headerSubtitle}>
              All your healthcare requests and their status
            </Text>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Feather name="inbox" size={48} color={AUTH_COLORS.textMuted} />
            <Text style={styles.emptyTitle}>No activities yet</Text>
            <Text style={styles.emptyBody}>
              When you submit healthcare requests, they will appear here with
              their status.
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            tintColor={AUTH_COLORS.green}
          />
        }
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
  header: {
    marginBottom: 20,
    marginTop: 8,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 6,
  },
  headerSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
  },
  gridRow: {
    justifyContent: "space-between",
  },
  emptyCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginTop: 16,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    marginTop: 8,
  },
});
