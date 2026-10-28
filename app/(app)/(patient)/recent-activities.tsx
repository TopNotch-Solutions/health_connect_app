import { Feather } from "@expo/vector-icons";
import { Stack, useFocusEffect } from "expo-router";
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
import { HeaderBackButton } from "../../../components/HeaderBackButton";
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
  paymentMethod?: "wallet" | "cash" | "medical_aid";
  symptoms?: string;
  consultationCost?: number;
  estimatedCost?: number;
  medicalAidDetails?: {
    medicalAidTitle?: string;
    medicalAidImage?: string;
    membershipNumber?: string;
    maf?: string;
    mainMemberName?: string;
    mainMemberId?: string;
    residentialAddress?: string;
    postalAddress?: {
      formatted?: string;
      postOffice?: string;
      postcode?: string;
    };
    icd10Code?: string;
  };
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

const PAGE_SIZE = 10;

const toHistoryItem = (request: RequestStatus): HistoryItem => ({
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
  medicalAidDetails: request.medicalAidDetails
    ? {
        medicalAidTitle: request.medicalAidDetails.medicalAidTitle,
        medicalAidImage: request.medicalAidDetails.medicalAidImage,
        membershipNumber: request.medicalAidDetails.membershipNumber,
        maf: request.medicalAidDetails.maf,
        mainMemberName: request.medicalAidDetails.mainMemberName,
        mainMemberId: request.medicalAidDetails.mainMemberId,
        residentialAddress: request.medicalAidDetails.residentialAddress,
        postalAddress: request.medicalAidDetails.postalAddress
          ? {
              formatted: request.medicalAidDetails.postalAddress.formatted,
              postOffice: request.medicalAidDetails.postalAddress.postOffice,
              postcode: request.medicalAidDetails.postalAddress.postcode,
            }
          : undefined,
        icd10Code: request.medicalAidDetails.icd10Code,
      }
    : undefined,
});

export default function RecentActivities() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<RequestStatus[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchPage = useCallback(
    async (pageToLoad: number, mode: "replace" | "append") => {
      if (!user?.userId) {
        setRequests([]);
        setTotal(0);
        setHasMore(false);
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
        return;
      }

      try {
        await socketService.waitForConnection(10000);
        if (!socketService.getSocket()?.connected) {
          throw new Error("Socket not connected");
        }

        const payload = await socketService.getPatientRequests(user.userId, {
          page: pageToLoad,
          limit: PAGE_SIZE,
          paginated: true,
        });

        const list = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.requests)
            ? payload.requests
            : [];
        const pagination = Array.isArray(payload)
          ? null
          : payload?.pagination || null;

        setPage(pageToLoad);
        if (pagination) {
          setTotal(pagination.total);
          setHasMore(Boolean(pagination.hasMore));
        } else {
          setTotal((prev) =>
            mode === "replace" ? list.length : Math.max(prev, list.length),
          );
          setHasMore(list.length >= PAGE_SIZE);
        }

        setRequests((prev) => {
          if (mode === "replace") return list;
          const seen = new Set(prev.map((r) => r._id));
          const next = [...prev];
          for (const item of list) {
            if (!seen.has(item._id)) {
              next.push(item);
              seen.add(item._id);
            }
          }
          return next;
        });
      } catch (error) {
        console.error("Error loading recent activities:", error);
        if (mode === "replace") {
          setRequests([]);
          setTotal(0);
          setHasMore(false);
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [user?.userId],
  );

  const reloadFirstPage = useCallback(async () => {
    setIsLoading(true);
    await fetchPage(1, "replace");
  }, [fetchPage]);

  useEffect(() => {
    void reloadFirstPage();
  }, [reloadFirstPage]);

  useFocusEffect(
    useCallback(() => {
      void fetchPage(1, "replace");
    }, [fetchPage]),
  );

  useEffect(() => {
    const refresh = () => {
      void fetchPage(1, "replace");
    };
    socketService.on("requestUpdated", refresh);
    socketService.on("requestStatusChanged", refresh);
    return () => {
      socketService.off("requestUpdated", refresh);
      socketService.off("requestStatusChanged", refresh);
    };
  }, [fetchPage]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    void fetchPage(1, "replace");
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (!hasMore || isLoadingMore || isLoading || isRefreshing) return;
    setIsLoadingMore(true);
    void fetchPage(page + 1, "append");
  }, [fetchPage, hasMore, isLoadingMore, isLoading, isRefreshing, page]);

  const historyItems = useMemo(
    () => requests.map(toHistoryItem),
    [requests],
  );

  const stackScreen = (
    <Stack.Screen
      options={{
        headerShown: true,
        headerTransparent: false,
        headerStyle: { backgroundColor: AUTH_COLORS.bg },
        title: "",
        headerLeft: () => <HeaderBackButton size={30} />,
      }}
    />
  );

  if (isLoading && historyItems.length === 0) {
    return (
      <ScreenLayout edges={SCREEN_EDGES_STACK} backgroundColor={AUTH_COLORS.bg}>
        {stackScreen}
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AUTH_COLORS.green} />
          <Text style={styles.loadingText}>Loading your activities...</Text>
        </View>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout edges={SCREEN_EDGES_STACK} backgroundColor={AUTH_COLORS.bg}>
      {stackScreen}
      <FlatList
        data={historyItems}
        keyExtractor={(item) => item._id}
        numColumns={2}
        columnWrapperStyle={styles.gridRow}
        renderItem={({ item }) => <HistoryCard item={item} />}
        contentContainerStyle={styles.listContent}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Recent activity</Text>
            <Text style={styles.headerSubtitle}>
              All your healthcare requests and their status
              {total > 0
                ? ` · showing ${historyItems.length} of ${total}`
                : ""}
            </Text>
          </View>
        }
        ListFooterComponent={
          historyItems.length === 0 ? undefined : isLoadingMore ? (
            <View style={styles.footer}>
              <ActivityIndicator size="small" color={AUTH_COLORS.green} />
              <Text style={styles.footerText}>Loading more…</Text>
            </View>
          ) : hasMore ? (
            <View style={styles.footer}>
              <Text style={styles.footerText}>Scroll for more</Text>
            </View>
          ) : (
            <Text style={styles.footerEnd}>
              {total <= PAGE_SIZE ? "" : "You've reached the end"}
            </Text>
          )
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
    paddingTop: 8,
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
  footer: {
    paddingVertical: 16,
    alignItems: "center",
    gap: 8,
  },
  footerText: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
  },
  footerEnd: {
    paddingVertical: 16,
    textAlign: "center",
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
  },
});
