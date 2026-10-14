import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  AppEmptyState,
  AppFilterChips,
  AppHeroCard,
  AppScreenShell,
  appScreenStyles,
  getGreeting,
  getGreetingEmoji,
  AUTH_COLORS,
} from "../../../components/app/AppScreenUI";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../lib/api";
import { buildBackendAssetUrl } from "../../../lib/backend";
import {
  downloadMedicalAidClaim,
  downloadMedicalAidClaims,
} from "../../../lib/downloadMedicalAidClaim";

type MedicalAidStats = {
  eligible: boolean;
  totalMedicalAidConsultations: number;
  activeMedicalAidConsultations: number;
  completedMedicalAidConsultations: number;
  currentMonthMedicalAidConsultations: number;
  currentMonthMedicalAidEarnings: number;
  totalMedicalAidEarnings: number;
};

type MedicalAidConsultation = {
  _id: string;
  status: string;
  consultationCost?: number;
  consultationMode?: string;
  createdAt?: string;
  updatedAt?: string;
  patientId?: {
    fullname?: string;
    cellphoneNumber?: string;
    nationalId?: string;
    profileImage?: string;
  };
  ailmentCategoryId?: {
    title?: string;
  };
  medicalAidDetails?: {
    medicalAidTitle?: string;
    medicalAidImage?: string;
    membershipNumber?: string;
    mainMemberName?: string;
    residentialAddress?: string;
    icd10Code?: string;
  };
  medicalAidClaimDownload?: {
    downloaded?: boolean;
    downloadedAt?: string;
    downloadCount?: number;
    claimed?: boolean;
    claimedAt?: string;
  };
  timeline?: {
    consultationCompleted?: string;
    consultationStarted?: string;
  };
};

type FilterKey = "all" | "active" | "completed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
];

const PAGE_SIZE = 20;

const ACTIVE_STATUSES = new Set([
  "accepted",
  "payment_pending",
  "paid",
  "provider_confirmation_pending",
  "ready_for_call",
  "in_call",
  "en_route",
  "arrived",
  "in_progress",
]);

function isClaimDownloaded(item: MedicalAidConsultation) {
  return Boolean(item.medicalAidClaimDownload?.downloaded);
}

function isClaimClaimed(item: MedicalAidConsultation) {
  return Boolean(item.medicalAidClaimDownload?.claimed);
}

/** Unclaimed / not-downloaded first, then newest activity. */
function sortNotDownloadedFirst(items: MedicalAidConsultation[]) {
  return [...items].sort((a, b) => {
    const aClaimed = isClaimClaimed(a) ? 1 : 0;
    const bClaimed = isClaimClaimed(b) ? 1 : 0;
    if (aClaimed !== bClaimed) return aClaimed - bClaimed;
    const aDownloaded = isClaimDownloaded(a) ? 1 : 0;
    const bDownloaded = isClaimDownloaded(b) ? 1 : 0;
    if (aDownloaded !== bDownloaded) return aDownloaded - bDownloaded;
    const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bTime - aTime;
  });
}

function formatMoney(amount?: number) {
  return `N$ ${Number(amount || 0).toFixed(2)}`;
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function statusMeta(status: string) {
  if (status === "completed") {
    return { label: "Completed", color: AUTH_COLORS.green, bg: "rgba(187, 247, 208, 0.45)" };
  }
  if (ACTIVE_STATUSES.has(status)) {
    return { label: "Active", color: "#B45309", bg: "rgba(254, 243, 199, 0.9)" };
  }
  return { label: status.replace(/_/g, " "), color: AUTH_COLORS.textMuted, bg: "#F3F4F6" };
}

export default function ProviderMedicalAidScreen() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState<MedicalAidStats | null>(null);
  const [consultations, setConsultations] = useState<MedicalAidConsultation[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [totalItems, setTotalItems] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [usingHistoryFallback, setUsingHistoryFallback] = useState(false);
  const [fallbackAll, setFallbackAll] = useState<MedicalAidConsultation[]>([]);

  const isMedicalAidRequest = useCallback((item: any) => {
    if (!item) return false;
    if (item.paymentMethod === "medical_aid") return true;
    const details = item.medicalAidDetails;
    if (!details) return false;
    return Boolean(
      details.membershipNumber ||
        details.medicalAidId ||
        details.medicalAidTitle ||
        details.icd10Code,
    );
  }, []);

  const applyStatusFilter = useCallback(
    (items: MedicalAidConsultation[], statusKey: FilterKey) => {
      if (statusKey === "completed") {
        return items.filter((item) => item.status === "completed");
      }
      if (statusKey === "active") {
        return items.filter((item) => ACTIVE_STATUSES.has(item.status));
      }
      return items;
    },
    [],
  );

  const loadConsultationsPage = useCallback(
    async ({
      pageToLoad,
      statusKey,
      append,
    }: {
      pageToLoad: number;
      statusKey: FilterKey;
      append: boolean;
    }) => {
      try {
        const listRes = await apiClient.get("/app/medical-aid/consultations", {
          params: {
            page: pageToLoad,
            limit: PAGE_SIZE,
            status: statusKey,
          },
        });
        const payload = listRes.data;
        let pageItems: MedicalAidConsultation[] = [];
        if (Array.isArray(payload?.data)) {
          pageItems = payload.data;
        } else if (Array.isArray(payload?.consultations)) {
          pageItems = payload.consultations;
        } else if (Array.isArray(payload)) {
          pageItems = payload;
        }

        pageItems = sortNotDownloadedFirst(pageItems);
        const pagination = payload?.pagination || {};
        const nextHasMore = Boolean(pagination.hasNextPage);
        const nextTotal =
          Number(pagination.totalItems ?? payload?.total ?? pageItems.length) ||
          0;

        setUsingHistoryFallback(false);
        setFallbackAll([]);
        setConsultations((prev) => {
          if (!append) return pageItems;
          const seen = new Set(prev.map((item) => item._id));
          const merged = [
            ...prev,
            ...pageItems.filter((item) => !seen.has(item._id)),
          ];
          return sortNotDownloadedFirst(merged);
        });
        setPage(pageToLoad);
        setHasMore(nextHasMore);
        setTotalItems(nextTotal);
        if (!append) {
          setSelectedIds((prev) =>
            prev.filter((id) => pageItems.some((item) => item._id === id)),
          );
        }
        return { ok: true as const };
      } catch (err: any) {
        console.error(
          "Medical aid consultations endpoint failed, falling back to history:",
          err,
        );
        try {
          const historyRes = await apiClient.get("/app/requests/my-history");
          const history = Array.isArray(historyRes.data?.requests)
            ? historyRes.data.requests
            : [];
          const all = sortNotDownloadedFirst(
            applyStatusFilter(
              history.filter(isMedicalAidRequest),
              statusKey,
            ),
          );
          const start = (pageToLoad - 1) * PAGE_SIZE;
          const pageItems = all.slice(start, start + PAGE_SIZE);
          setUsingHistoryFallback(true);
          setFallbackAll(all);
          setConsultations((prev) =>
            append
              ? sortNotDownloadedFirst([
                  ...prev,
                  ...pageItems.filter(
                    (item) => !prev.some((existing) => existing._id === item._id),
                  ),
                ])
              : pageItems,
          );
          setPage(pageToLoad);
          setHasMore(start + PAGE_SIZE < all.length);
          setTotalItems(all.length);
          if (!append) {
            setSelectedIds((prev) =>
              prev.filter((id) => pageItems.some((item) => item._id === id)),
            );
          }
          return { ok: true as const };
        } catch (historyErr: any) {
          console.error("History fallback failed:", historyErr);
          return {
            ok: false as const,
            message:
              historyErr?.response?.data?.message ||
              err?.response?.data?.message ||
              "Failed to load medical aid consultations. Please try again.",
          };
        }
      }
    },
    [applyStatusFilter, isMedicalAidRequest],
  );

  const loadData = useCallback(async () => {
    setError(null);

    let nextStats: MedicalAidStats | null = null;
    let loadError: string | null = null;

    try {
      const statsRes = await apiClient.get("/app/medical-aid/provider-stats");
      const statsData = statsRes.data;
      nextStats = {
        eligible: Boolean(statsData?.eligible),
        totalMedicalAidConsultations:
          statsData?.totalMedicalAidConsultations ?? 0,
        activeMedicalAidConsultations:
          statsData?.activeMedicalAidConsultations ?? 0,
        completedMedicalAidConsultations:
          statsData?.completedMedicalAidConsultations ?? 0,
        currentMonthMedicalAidConsultations:
          statsData?.currentMonthMedicalAidConsultations ?? 0,
        currentMonthMedicalAidEarnings:
          statsData?.currentMonthMedicalAidEarnings ?? 0,
        totalMedicalAidEarnings: statsData?.totalMedicalAidEarnings ?? 0,
      };
    } catch (err: any) {
      console.error("Error loading medical aid stats:", err);
      loadError =
        err?.response?.data?.message ||
        "Failed to load medical aid stats. Please try again.";
    }

    const listResult = await loadConsultationsPage({
      pageToLoad: 1,
      statusKey: filter,
      append: false,
    });
    if (!listResult.ok) {
      loadError = listResult.message;
      setConsultations([]);
      setHasMore(false);
      setTotalItems(0);
      setPage(1);
    }

    setStats(nextStats);
    setError(loadError);
    setIsLoading(false);
    setRefreshing(false);
  }, [filter, loadConsultationsPage]);

  useFocusEffect(
    useCallback(() => {
      setIsLoading(true);
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
  }, [loadData]);

  const handleFilterChange = useCallback((key: string) => {
    setFilter(key as FilterKey);
    setIsLoading(true);
    setError(null);
    setConsultations([]);
    setSelectedIds([]);
    setPage(1);
    setHasMore(false);
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || isLoading) return;
    setIsLoadingMore(true);
    try {
      if (usingHistoryFallback) {
        const nextPage = page + 1;
        const start = (nextPage - 1) * PAGE_SIZE;
        const pageItems = fallbackAll.slice(start, start + PAGE_SIZE);
        setConsultations((prev) =>
          sortNotDownloadedFirst([
            ...prev,
            ...pageItems.filter(
              (item) => !prev.some((existing) => existing._id === item._id),
            ),
          ]),
        );
        setPage(nextPage);
        setHasMore(start + PAGE_SIZE < fallbackAll.length);
      } else {
        await loadConsultationsPage({
          pageToLoad: page + 1,
          statusKey: filter,
          append: true,
        });
      }
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    fallbackAll,
    filter,
    hasMore,
    isLoading,
    isLoadingMore,
    loadConsultationsPage,
    page,
    usingHistoryFallback,
  ]);

  const filteredConsultations = consultations;

  const downloadableVisible = useMemo(
    () =>
      filteredConsultations.filter(
        (item) => item.status === "completed" && !isClaimClaimed(item),
      ),
    [filteredConsultations],
  );

  const selectedVisibleIds = useMemo(
    () =>
      selectedIds.filter((id) =>
        downloadableVisible.some((item) => item._id === id),
      ),
    [selectedIds, downloadableVisible],
  );

  const allVisibleSelected =
    downloadableVisible.length > 0 &&
    selectedVisibleIds.length === downloadableVisible.length;

  const toggleSelect = useCallback(
    (item: MedicalAidConsultation) => {
      if (item.status !== "completed") {
        Alert.alert(
          "Not available yet",
          "You can only download claims for completed consultations.",
        );
        return;
      }
      if (isClaimClaimed(item)) {
        Alert.alert(
          "Already claimed",
          "This consultation has been marked as claimed and can no longer be downloaded.",
        );
        return;
      }
      setSelectedIds((prev) =>
        prev.includes(item._id)
          ? prev.filter((id) => id !== item._id)
          : [...prev, item._id],
      );
    },
    [],
  );

  const toggleSelectAllVisible = useCallback(() => {
    if (downloadableVisible.length === 0) {
      Alert.alert(
        "No available claims",
        "Only unclaimed completed consultations can be selected for download.",
      );
      return;
    }
    if (allVisibleSelected) {
      setSelectedIds((prev) =>
        prev.filter(
          (id) => !downloadableVisible.some((item) => item._id === id),
        ),
      );
      return;
    }
    setSelectedIds((prev) => {
      const next = new Set(prev);
      downloadableVisible.forEach((item) => next.add(item._id));
      return Array.from(next);
    });
  }, [allVisibleSelected, downloadableVisible]);

  const markClaimsDownloaded = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const patchItem = (item: MedicalAidConsultation) => {
      if (!idSet.has(item._id)) return item;
      const previousCount = Number(
        item.medicalAidClaimDownload?.downloadCount || 0,
      );
      return {
        ...item,
        medicalAidClaimDownload: {
          ...item.medicalAidClaimDownload,
          downloaded: true,
          downloadedAt: now,
          downloadCount: previousCount + 1,
        },
      };
    };
    setConsultations((prev) => sortNotDownloadedFirst(prev.map(patchItem)));
    setFallbackAll((prev) => sortNotDownloadedFirst(prev.map(patchItem)));
  }, []);

  const markClaimsClaimed = useCallback((ids: string[]) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const now = new Date().toISOString();
    const patchItem = (item: MedicalAidConsultation) => {
      if (!idSet.has(item._id)) return item;
      return {
        ...item,
        medicalAidClaimDownload: {
          ...item.medicalAidClaimDownload,
          claimed: true,
          claimedAt: now,
        },
      };
    };
    setConsultations((prev) => sortNotDownloadedFirst(prev.map(patchItem)));
    setFallbackAll((prev) => sortNotDownloadedFirst(prev.map(patchItem)));
    setSelectedIds((prev) => prev.filter((id) => !idSet.has(id)));
  }, []);

  const handleDownload = useCallback(async (item: MedicalAidConsultation) => {
    if (isBatchDownloading || claimingId) return;
    if (item.status !== "completed") {
      Alert.alert(
        "Not available yet",
        "You can only download claims for completed consultations.",
      );
      return;
    }
    if (isClaimClaimed(item)) {
      Alert.alert(
        "Already claimed",
        "This consultation has been marked as claimed and can no longer be downloaded.",
      );
      return;
    }
    try {
      setDownloadingId(item._id);
      await downloadMedicalAidClaim({
        consultationId: item._id,
        filenameHint:
          item.patientId?.fullname ||
          item.medicalAidDetails?.mainMemberName ||
          "claim",
      });
      markClaimsDownloaded([item._id]);
    } catch (err: any) {
      console.error("Claim download failed:", err);
      Alert.alert(
        "Download failed",
        err?.response?.data?.message ||
          err?.message ||
          "Could not download this consultation claim.",
      );
    } finally {
      setDownloadingId(null);
    }
  }, [claimingId, isBatchDownloading, markClaimsDownloaded]);

  const handleMarkClaimed = useCallback(
    async (item: MedicalAidConsultation) => {
      if (isBatchDownloading || downloadingId || claimingId) return;
      if (item.status !== "completed") {
        Alert.alert(
          "Not available yet",
          "Only completed consultations can be marked as claimed.",
        );
        return;
      }
      if (isClaimClaimed(item)) return;

      Alert.alert(
        "Mark as claimed",
        "This will grey out the consultation and stop further downloads. Continue?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Mark claimed",
            style: "destructive",
            onPress: async () => {
              try {
                setClaimingId(item._id);
                await apiClient.post(
                  `/app/medical-aid/consultations/${item._id}/mark-claimed`,
                );
                markClaimsClaimed([item._id]);
              } catch (err: any) {
                console.error("Mark claimed failed:", err);
                Alert.alert(
                  "Could not mark claimed",
                  err?.response?.data?.message ||
                    err?.message ||
                    "Please try again.",
                );
              } finally {
                setClaimingId(null);
              }
            },
          },
        ],
      );
    },
    [claimingId, downloadingId, isBatchDownloading, markClaimsClaimed],
  );

  const handleDownloadSelected = useCallback(async () => {
    if (isBatchDownloading || downloadingId) return;

    const selectedItems = downloadableVisible.filter((item) =>
      selectedVisibleIds.includes(item._id),
    );
    if (selectedItems.length === 0) {
      Alert.alert(
        "No claims selected",
        "Select one or more completed consultations to download.",
      );
      return;
    }

    try {
      setIsBatchDownloading(true);
      setBatchProgress({ done: 0, total: selectedItems.length });
      const result = await downloadMedicalAidClaims(
        selectedItems.map((item) => ({
          consultationId: item._id,
          filenameHint:
            item.patientId?.fullname ||
            item.medicalAidDetails?.mainMemberName ||
            "claim",
        })),
        (done, total) => setBatchProgress({ done, total }),
      );

      if (result.downloadedIds.length > 0) {
        markClaimsDownloaded(result.downloadedIds);
      }

      if (result.failed > 0) {
        Alert.alert(
          "Partial download",
          `Saved ${result.downloaded} claim${result.downloaded === 1 ? "" : "s"}. ${result.failed} failed.`,
        );
      } else if (result.downloaded > 1) {
        Alert.alert(
          "Claims ready",
          `${result.downloaded} claim PDFs were prepared for saving.`,
        );
      }
      setSelectedIds([]);
    } catch (err: any) {
      console.error("Batch claim download failed:", err);
      Alert.alert(
        "Download failed",
        err?.message || "Could not download the selected claims.",
      );
    } finally {
      setIsBatchDownloading(false);
      setBatchProgress(null);
    }
  }, [
    downloadableVisible,
    downloadingId,
    isBatchDownloading,
    markClaimsDownloaded,
    selectedVisibleIds,
  ]);

  const firstName = user?.fullname?.split(" ")[0] || "Provider";
  const canShowWorkspace =
    Boolean(stats?.eligible) || consultations.length > 0;

  const summary = {
    total:
      stats?.totalMedicalAidConsultations ??
      consultations.length,
    active:
      stats?.activeMedicalAidConsultations ??
      consultations.filter((item) => ACTIVE_STATUSES.has(item.status)).length,
    completed:
      stats?.completedMedicalAidConsultations ??
      consultations.filter((item) => item.status === "completed").length,
    monthEarnings: stats?.currentMonthMedicalAidEarnings ?? 0,
  };

  return (
    <AppScreenShell>
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
        {!isLoading && !canShowWorkspace ? (
          <AppHeroCard
            eyebrow={`${getGreeting()} ${getGreetingEmoji()}`}
            name={firstName}
            tagline="Medical aid consultation overview for your practice."
          />
        ) : null}

        {isLoading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={AUTH_COLORS.green} />
            <Text style={styles.loadingText}>Loading medical aid…</Text>
          </View>
        ) : (
          <>
            {error ? (
              <View style={styles.messageCard}>
                <Feather name="alert-circle" size={20} color="#B45309" />
                <Text style={styles.messageText}>{error}</Text>
              </View>
            ) : null}

            {!canShowWorkspace ? (
              <View style={styles.messageCard}>
                <Feather name="info" size={20} color={AUTH_COLORS.green} />
                <Text style={styles.messageText}>
                  Your current specializations are not linked to medical aid
                  ICD-10 codes, so medical aid consultations are not available.
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.summaryStrip}>
                  <SummaryPill
                    icon="layers"
                    label="Total"
                    value={String(summary.total)}
                  />
                  <SummaryPill
                    icon="activity"
                    label="Active"
                    value={String(summary.active)}
                  />
                  <SummaryPill
                    icon="check-circle"
                    label="Done"
                    value={String(summary.completed)}
                  />
                  <SummaryPill
                    icon="dollar-sign"
                    label="Month"
                    value={`N$ ${Number(summary.monthEarnings || 0).toFixed(0)}`}
                  />
                </View>

                <View style={styles.listHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.listTitle}>Consultations</Text>
                    <Text style={styles.listSubtitle}>
                      Select one or more claims to download at once
                    </Text>
                  </View>
                  <View style={styles.countBadge}>
                    <Text style={styles.countBadgeText}>
                      {totalItems || filteredConsultations.length}
                    </Text>
                  </View>
                </View>

                <AppFilterChips
                  filters={FILTERS}
                  active={filter}
                  onChange={handleFilterChange}
                />

                {filteredConsultations.length > 0 ? (
                  <View style={styles.selectionBar}>
                    <Pressable
                      style={styles.selectAllBtn}
                      onPress={toggleSelectAllVisible}
                      disabled={isBatchDownloading}
                    >
                      <View
                        style={[
                          styles.checkbox,
                          allVisibleSelected && styles.checkboxSelected,
                        ]}
                      >
                        {allVisibleSelected ? (
                          <Feather
                            name="check"
                            size={12}
                            color={AUTH_COLORS.white}
                          />
                        ) : null}
                      </View>
                      <Text style={styles.selectAllText}>
                        {allVisibleSelected ? "Clear all" : "Select all"}
                      </Text>
                    </Pressable>

                    <Pressable
                      style={[
                        styles.batchDownloadBtn,
                        (selectedVisibleIds.length === 0 ||
                          isBatchDownloading) &&
                          styles.batchDownloadBtnDisabled,
                      ]}
                      onPress={handleDownloadSelected}
                      disabled={
                        selectedVisibleIds.length === 0 || isBatchDownloading
                      }
                    >
                      {isBatchDownloading ? (
                        <ActivityIndicator
                          size="small"
                          color={AUTH_COLORS.white}
                        />
                      ) : (
                        <Feather
                          name="download"
                          size={14}
                          color={AUTH_COLORS.white}
                        />
                      )}
                      <Text style={styles.batchDownloadText}>
                        {isBatchDownloading && batchProgress
                          ? `${batchProgress.done}/${batchProgress.total}`
                          : selectedVisibleIds.length > 0
                            ? `Download ${selectedVisibleIds.length}`
                            : "Download"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}

                {filteredConsultations.length === 0 ? (
                  <View style={{ paddingHorizontal: 20 }}>
                    <AppEmptyState
                      icon="inbox"
                      title="No consultations yet"
                      body="Accept a medical aid request, then return here to download the claim statement."
                    />
                  </View>
                ) : (
                  <View style={styles.list}>
                    {filteredConsultations.map((item) => (
                      <ConsultationClaimCard
                        key={item._id}
                        item={item}
                        selected={selectedIds.includes(item._id)}
                        onToggleSelect={() => toggleSelect(item)}
                        downloading={
                          downloadingId === item._id ||
                          (isBatchDownloading &&
                            selectedVisibleIds.includes(item._id))
                        }
                        claiming={claimingId === item._id}
                        selectionDisabled={
                          isBatchDownloading || Boolean(claimingId)
                        }
                        onDownload={() => handleDownload(item)}
                        onMarkClaimed={() => handleMarkClaimed(item)}
                      />
                    ))}

                    <View style={styles.paginationContainer}>
                      <View style={styles.paginationDivider}>
                        <View style={styles.paginationLine} />
                        <Text style={styles.paginationText}>
                          Showing {filteredConsultations.length} of{" "}
                          {totalItems || filteredConsultations.length}
                        </Text>
                        <View style={styles.paginationLine} />
                      </View>

                      {hasMore ? (
                        <Pressable
                          style={[
                            styles.loadMoreButton,
                            isLoadingMore && styles.loadMoreButtonDisabled,
                          ]}
                          onPress={loadMore}
                          disabled={isLoadingMore}
                        >
                          {isLoadingMore ? (
                            <ActivityIndicator
                              size="small"
                              color={AUTH_COLORS.white}
                            />
                          ) : (
                            <Feather
                              name="chevron-down"
                              size={18}
                              color={AUTH_COLORS.white}
                            />
                          )}
                          <Text style={styles.loadMoreButtonText}>
                            {isLoadingMore ? "Loading…" : "Load more"}
                          </Text>
                        </Pressable>
                      ) : totalItems > PAGE_SIZE ? (
                        <Text style={styles.allLoadedText}>
                          All claims loaded
                        </Text>
                      ) : null}
                    </View>
                  </View>
                )}
              </>
            )}
          </>
        )}
      </ScrollView>
    </AppScreenShell>
  );
}

function SummaryPill({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.summaryPill}>
      <Feather name={icon} size={14} color={AUTH_COLORS.green} />
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function ConsultationClaimCard({
  item,
  selected,
  onToggleSelect,
  downloading,
  claiming,
  selectionDisabled,
  onDownload,
  onMarkClaimed,
}: {
  item: MedicalAidConsultation;
  selected: boolean;
  onToggleSelect: () => void;
  downloading: boolean;
  claiming?: boolean;
  selectionDisabled?: boolean;
  onDownload: () => void;
  onMarkClaimed: () => void;
}) {
  const status = statusMeta(item.status);
  const claimed = isClaimClaimed(item);
  const canDownload = item.status === "completed" && !claimed;
  const alreadyDownloaded = Boolean(item.medicalAidClaimDownload?.downloaded);
  const downloadCount = Number(item.medicalAidClaimDownload?.downloadCount || 0);
  const patientName = item.patientId?.fullname || "Patient";
  const aidTitle = item.medicalAidDetails?.medicalAidTitle || "Medical Aid";
  const aidImage = buildBackendAssetUrl(
    "images",
    item.medicalAidDetails?.medicalAidImage,
  );
  const dateValue =
    item.timeline?.consultationCompleted ||
    item.timeline?.consultationStarted ||
    item.updatedAt ||
    item.createdAt;

  return (
    <View
      style={[
        styles.card,
        selected && styles.cardSelected,
        (!canDownload || claimed) && styles.cardDisabled,
        alreadyDownloaded && !claimed && styles.cardDownloaded,
        claimed && styles.cardClaimed,
      ]}
    >
      <View style={styles.cardTop}>
        <Pressable
          style={[styles.selectHit, !canDownload && styles.selectHitDisabled]}
          onPress={onToggleSelect}
          disabled={selectionDisabled || !canDownload}
          hitSlop={8}
        >
          <View
            style={[
              styles.checkbox,
              selected && styles.checkboxSelected,
              !canDownload && styles.checkboxDisabled,
            ]}
          >
            {selected ? (
              <Feather name="check" size={12} color={AUTH_COLORS.white} />
            ) : null}
          </View>
        </Pressable>
        <View style={styles.aidLogoWrap}>
          {aidImage ? (
            <Image source={{ uri: aidImage }} style={styles.aidLogo} />
          ) : (
            <Feather name="shield" size={18} color={AUTH_COLORS.green} />
          )}
        </View>
        <Pressable
          style={{ flex: 1 }}
          onPress={onToggleSelect}
          disabled={selectionDisabled || !canDownload}
        >
          <Text
            style={[styles.patientName, claimed && styles.claimedText]}
            numberOfLines={1}
          >
            {patientName}
          </Text>
          <Text
            style={[styles.aidTitle, claimed && styles.claimedText]}
            numberOfLines={1}
          >
            {aidTitle}
            {item.medicalAidDetails?.membershipNumber
              ? ` · MAF ${item.medicalAidDetails.membershipNumber}`
              : ""}
          </Text>
        </Pressable>
        <View style={styles.chipColumn}>
          <View style={[styles.statusChip, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusChipText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
          {claimed ? (
            <View style={styles.claimedChip}>
              <Feather name="archive" size={11} color="#6B7280" />
              <Text style={styles.claimedChipText}>Claimed</Text>
            </View>
          ) : alreadyDownloaded ? (
            <View style={styles.downloadedChip}>
              <Feather name="check-circle" size={11} color={AUTH_COLORS.green} />
              <Text style={styles.downloadedChipText}>Downloaded</Text>
            </View>
          ) : null}
        </View>
      </View>

      <View style={styles.metaGrid}>
        <MetaRow
          icon="activity"
          label="Ailment"
          value={item.ailmentCategoryId?.title || "Consultation"}
        />
        <MetaRow
          icon="hash"
          label="ICD-10"
          value={item.medicalAidDetails?.icd10Code || "—"}
        />
        <MetaRow icon="calendar" label="Date" value={formatDate(dateValue)} />
        <MetaRow
          icon="dollar-sign"
          label="Amount"
          value={formatMoney(item.consultationCost)}
        />
      </View>

      {claimed ? (
        <View style={styles.claimedBanner}>
          <Feather name="archive" size={14} color="#6B7280" />
          <Text style={styles.claimedBannerText}>
            Marked as claimed
            {item.medicalAidClaimDownload?.claimedAt
              ? ` · ${formatDate(item.medicalAidClaimDownload.claimedAt)}`
              : ""}
            {" · download disabled"}
          </Text>
        </View>
      ) : null}

      {alreadyDownloaded && !claimed ? (
        <View style={styles.downloadedBanner}>
          <Feather name="check-circle" size={14} color={AUTH_COLORS.green} />
          <Text style={styles.downloadedBannerText}>
            Claim already downloaded
            {item.medicalAidClaimDownload?.downloadedAt
              ? ` · ${formatDate(item.medicalAidClaimDownload.downloadedAt)}`
              : ""}
            {downloadCount > 1 ? ` · ${downloadCount}x` : ""}
          </Text>
        </View>
      ) : null}

      {item.status !== "completed" ? (
        <View style={styles.lockedBanner}>
          <Feather name="lock" size={14} color="#B45309" />
          <Text style={styles.lockedBannerText}>
            Complete this consultation before downloading the claim
          </Text>
        </View>
      ) : claimed ? null : (
        <View style={styles.actionRow}>
          <Pressable
            style={[
              styles.downloadBtn,
              styles.actionBtnFlex,
              alreadyDownloaded && styles.downloadBtnSecondary,
              downloading && styles.downloadBtnDisabled,
            ]}
            onPress={onDownload}
            disabled={downloading || selectionDisabled || claiming}
          >
            {downloading ? (
              <ActivityIndicator
                size="small"
                color={
                  alreadyDownloaded ? AUTH_COLORS.green : AUTH_COLORS.white
                }
              />
            ) : (
              <Feather
                name="download"
                size={16}
                color={
                  alreadyDownloaded ? AUTH_COLORS.green : AUTH_COLORS.white
                }
              />
            )}
            <Text
              style={[
                styles.downloadBtnText,
                alreadyDownloaded && styles.downloadBtnTextSecondary,
              ]}
            >
              {downloading
                ? "Preparing…"
                : alreadyDownloaded
                  ? "Download again"
                  : "Download"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.claimBtn,
              (claiming || downloading || selectionDisabled) &&
                styles.downloadBtnDisabled,
            ]}
            onPress={onMarkClaimed}
            disabled={claiming || downloading || selectionDisabled}
          >
            {claiming ? (
              <ActivityIndicator size="small" color="#4B5563" />
            ) : (
              <Feather name="archive" size={15} color="#4B5563" />
            )}
            <Text style={styles.claimBtnText}>
              {claiming ? "Saving…" : "Claimed"}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) {
  return (
    <View style={styles.metaRow}>
      <Feather name={icon} size={13} color={AUTH_COLORS.textMuted} />
      <View style={{ flex: 1 }}>
        <Text style={styles.metaLabel}>{label}</Text>
        <Text style={styles.metaValue} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: 40,
    alignItems: "center",
    gap: 12,
  },
  loadingText: {
    color: AUTH_COLORS.textMuted,
    fontSize: 14,
    fontWeight: "600",
  },
  messageCard: {
    marginHorizontal: 20,
    marginTop: 8,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  messageText: {
    flex: 1,
    color: AUTH_COLORS.textDark,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  summaryStrip: {
    marginHorizontal: 20,
    marginTop: 8,
    marginBottom: 20,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  summaryPill: {
    flexGrow: 1,
    minWidth: "22%",
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "flex-start",
    gap: 4,
  },
  summaryValue: {
    fontSize: 15,
    fontWeight: "800",
    color: AUTH_COLORS.greenDark,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  listHeader: {
    paddingHorizontal: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  listTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  listSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
  },
  countBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(187, 247, 208, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: "800",
    color: AUTH_COLORS.greenDark,
  },
  selectionBar: {
    marginHorizontal: 20,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  selectAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingRight: 8,
  },
  selectAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxSelected: {
    backgroundColor: AUTH_COLORS.green,
    borderColor: AUTH_COLORS.green,
  },
  batchDownloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  batchDownloadBtnDisabled: {
    opacity: 0.45,
  },
  batchDownloadText: {
    color: AUTH_COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  list: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 28,
  },
  paginationContainer: {
    marginTop: 8,
    marginBottom: 8,
    gap: 12,
  },
  paginationDivider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  paginationLine: {
    flex: 1,
    height: 1,
    backgroundColor: AUTH_COLORS.inputBorder,
  },
  paginationText: {
    fontSize: 11,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
  },
  loadMoreButton: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  loadMoreButtonDisabled: {
    opacity: 0.7,
  },
  loadMoreButtonText: {
    color: AUTH_COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
  allLoadedText: {
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  card: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 14,
  },
  cardSelected: {
    borderColor: AUTH_COLORS.green,
    backgroundColor: "rgba(187, 247, 208, 0.18)",
  },
  cardDownloaded: {
    borderColor: "rgba(34, 197, 94, 0.55)",
  },
  cardClaimed: {
    borderColor: "#D1D5DB",
    backgroundColor: "#F3F4F6",
    opacity: 0.78,
  },
  cardDisabled: {
    opacity: 0.92,
  },
  claimedText: {
    color: "#6B7280",
  },
  claimedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#E5E7EB",
  },
  claimedChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#4B5563",
  },
  claimedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 4,
  },
  claimedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#4B5563",
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtnFlex: {
    flex: 1,
  },
  claimBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: "#E5E7EB",
    borderWidth: 1,
    borderColor: "#D1D5DB",
  },
  claimBtnText: {
    fontSize: 13,
    fontWeight: "800",
    color: "#374151",
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  chipColumn: {
    alignItems: "flex-end",
    gap: 6,
  },
  downloadedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "rgba(187, 247, 208, 0.55)",
  },
  downloadedChipText: {
    fontSize: 10,
    fontWeight: "700",
    color: AUTH_COLORS.greenDark,
  },
  downloadedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(187, 247, 208, 0.4)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  downloadedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: AUTH_COLORS.greenDark,
  },
  downloadBtnSecondary: {
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 2,
    borderColor: AUTH_COLORS.green,
  },
  downloadBtnTextSecondary: {
    color: AUTH_COLORS.greenDark,
  },
  selectHit: {
    paddingVertical: 2,
  },
  selectHitDisabled: {
    opacity: 0.45,
  },
  checkboxDisabled: {
    backgroundColor: "#F3F4F6",
    borderColor: "#D1D5DB",
  },
  lockedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(254, 243, 199, 0.9)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  lockedBannerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#92400E",
  },
  aidLogoWrap: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: "rgba(187, 247, 208, 0.4)",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  aidLogo: {
    width: "100%",
    height: "100%",
  },
  patientName: {
    fontSize: 15,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  aidTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
  },
  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  statusChipText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
  },
  metaRow: {
    width: "47%",
    flexGrow: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "rgba(247, 250, 252, 0.95)",
    borderRadius: 12,
    padding: 10,
  },
  metaLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  metaValue: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginTop: 1,
  },
  downloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 12,
    paddingVertical: 12,
  },
  downloadBtnDisabled: {
    opacity: 0.7,
  },
  downloadBtnText: {
    color: AUTH_COLORS.white,
    fontSize: 13,
    fontWeight: "800",
  },
});
