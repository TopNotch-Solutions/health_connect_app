import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { iosInputIconSize, withIosInputContainerStyle, withIosMultilineTextInputStyle, withIosOtpTextInputStyle, withIosStandaloneTextInputStyle, withIosTextInputStyle } from "../../../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../../../components/AppTextInput";
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  getPatientLocationFromRequest,
  getRequestProviderId,
} from "../../../../lib/coordinate";
import {
  AppEmptyState,
  AppFilterChips,
  AppHeroCard,
  AppLoadingCard,
  AppScreenShell,
  appScreenStyles,
  getGreeting,
  getGreetingEmoji,
  AUTH_COLORS,
} from "../../../../components/app/AppScreenUI";
import { useAuth } from "../../../../context/AuthContext";
import { useRoute } from "../../../../context/RouteContext";
import apiClient from "../../../../lib/api";
import {
  attachAuthToAssetUrl,
  buildBackendAssetUrl,
  withAccessTokenQuery,
  type AuthenticatedAssetSource,
} from "../../../../lib/backend";
import { downloadPrescriptionFile } from "../../../../lib/downloadPrescription";
import {
  ensureForegroundLocationPermission,
  resolveProviderCoordsForAccept,
} from "../../../../lib/locationPermission";
import { alertNewRequestAvailable } from "../../../../lib/consultationAlert";
import socketService from "../../../../lib/socket";
import { canShowPatientPhone } from "../../../../lib/patientContactVisibility";
import { getUserFacingErrorMessage } from "../../../../lib/userFacingError";
import ProviderPrescriptionPanel from "../../../../components/(provider)/ProviderPrescriptionPanel";
import PostalAddressConfirmModal from "../../../../components/(patient)/PostalAddressConfirmModal";
import { showAlertDialog } from "@/components/AlertDialog";

interface PrescriptionData {
  _id: string;
  requestId?: string | { _id: string };
  status: "pending_review" | "accepted" | "rejected" | "cancelled";
  prescriptionImage: string | null;
  fileType: "image" | "pdf" | null;
  rejectionReason?: string | null;
  patientId?: { fullname: string; cellphoneNumber: string };
}

interface Request {
  _id: string;
  patientId: {
    fullname: string;
    cellphoneNumber?: string;
    walletID?: string;
    profileImage?: string;
  };
  providerId?: {
    _id?: string;
    fullname?: string;
    profileImage?: string;
  };
  ailmentCategoryId?:
    | {
        title: string;
      }
    | string;
  status:
    | "searching"
    | "pending"
    | "accepted"
    | "payment_pending"
    | "paid"
    | "provider_confirmation_pending"
    | "ready_for_call"
    | "in_call"
    | "rejected"
    | "en_route"
    | "arrived"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "expired";
  consultationCost?: number | string;
  estimatedCost?: number | string;
  symptoms?: string;
  address?: {
    route?: string;
    locality: string;
    administrative_area_level_1: string;
    coordinates?: {
      latitude: number;
      longitude: number;
    };
  };
  createdAt?: string;
  timeline?: any;
  [key: string]: any;
}

const PAGE_SIZE = 10;

function isProviderArchived(item: Request) {
  return Boolean(item.providerArchive?.archived);
}

export default function ProviderRequests() {
  const [filter, setFilter] = useState<
    "all" | "pending" | "accepted" | "completed" | "archived"
  >("all");
  const [requests, setRequests] = useState<Request[]>([]);
  const requestsRef = useRef<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [archivedRequests, setArchivedRequests] = useState<Request[]>([]);
  const [archivedPage, setArchivedPage] = useState(1);
  const [archivedHasMore, setArchivedHasMore] = useState(false);
  const [archivedTotal, setArchivedTotal] = useState(0);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const [archivedLoadingMore, setArchivedLoadingMore] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<{
    requestId: string;
    action:
      | "accept"
      | "decline"
      | "route"
      | "start"
      | "complete"
      | "payment_received";
  } | null>(null);
  const acceptInFlightRef = useRef(false);
  const { startRoute } = useRoute();
  const { user } = useAuth();
  const router = useRouter();
  const [showPostalAddressModal, setShowPostalAddressModal] = useState(false);
  const [pendingAcceptRequest, setPendingAcceptRequest] =
    useState<Request | null>(null);

  // Pharmacist prescription state
  const isPharmacist = user?.role === "pharmacist";
  const canIssueClinicalPrescription =
    user?.role === "doctor" ||
    (user?.role === "nurse" && !!user?.dispensingCertificateLicence);
  const [prescriptions, setPrescriptions] = useState<PrescriptionData[]>([]);
  const [prescriptionLoading, setPrescriptionLoading] = useState<string | null>(null);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<{ prescriptionId: string; patientName: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [imageViewerSource, setImageViewerSource] =
    useState<AuthenticatedAssetSource | null>(null);
  const [prescriptionPreviewSources, setPrescriptionPreviewSources] = useState<
    Record<string, AuthenticatedAssetSource>
  >({});

  const loadPrescriptions = useCallback(async () => {
    if (!isPharmacist) return;
    try {
      const res = await apiClient.get("/app/prescription/pharmacist/all");
      const list: PrescriptionData[] = res.data.prescriptions || [];
      setPrescriptions(list);

      // Prefetch authenticated sources for gated prescription images
      const nextSources: Record<string, AuthenticatedAssetSource> = {};
      await Promise.all(
        list.map(async (p) => {
          if (!p.prescriptionImage || p.fileType !== "image") return;
          const url = buildBackendAssetUrl("images", p.prescriptionImage);
          if (!url) return;
          nextSources[p._id] = await attachAuthToAssetUrl(url);
        }),
      );
      setPrescriptionPreviewSources(nextSources);
    } catch (err) {
      console.error("Error loading prescriptions:", err);
    }
  }, [isPharmacist]);

  const handleAcceptPrescription = async (prescriptionId: string) => {
    try {
      setPrescriptionLoading(prescriptionId);
      await apiClient.patch(`/app/prescription/${prescriptionId}/accept`);
      await loadPrescriptions();
      await loadRequests();
      Alert.alert("Accepted", "Prescription accepted. Delivery flow started.");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Could not accept prescription.");
    } finally {
      setPrescriptionLoading(null);
    }
  };

  const handleRejectPrescription = async () => {
    if (!rejectTarget) return;
    try {
      setPrescriptionLoading(rejectTarget.prescriptionId);
      await apiClient.patch(`/app/prescription/${rejectTarget.prescriptionId}/reject`, {
        reason: rejectReason.trim() || undefined,
      });
      setRejectModalVisible(false);
      setRejectReason("");
      setRejectTarget(null);
      await loadPrescriptions();
      Alert.alert("Rejected", "Patient has been notified to re-upload.");
    } catch (err: any) {
      Alert.alert("Error", err?.response?.data?.message || "Could not reject prescription.");
    } finally {
      setPrescriptionLoading(null);
    }
  };
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  const loadRequests = useCallback(async () => {
    if (!user?.userId) {
      setIsLoading(false);
      return;
    }

    try {
      // Only show the full-screen spinner on the very first load.
      // Background refreshes (from socket events, polling, focus) update silently
      // so cards stay visible and buttons appear instantly.
      if (!hasLoadedOnce.current) {
        setIsLoading(true);
      }

      await socketService.waitForConnection(10000);

      // Home shows unclaimed "searching" jobs via getAvailableRequests.
      // Requests previously only loaded assigned jobs (providerId match), so
      // new requests appeared on Home but vanished from this tab on reload.
      let providerLocation: { latitude: number; longitude: number } | null =
        null;
      try {
        const { granted } = await ensureForegroundLocationPermission({
          requestIfNeeded: !hasLoadedOnce.current,
        });
        if (granted) {
          const lastKnown = await Location.getLastKnownPositionAsync();
          const position =
            lastKnown ??
            (await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
            }));
          providerLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
        }
      } catch (locErr) {
        console.warn(
          "?? Could not get provider location for available requests:",
          locErr,
        );
      }

      const [socketRequests, availableResult] = await Promise.all([
        socketService.getProviderRequests(user.userId).catch((err) => {
          console.warn("?? getProviderRequests failed:", err);
          return [];
        }),
        providerLocation
          ? socketService
              .getAvailableRequests(user.userId, providerLocation, {
                page: 1,
                limit: 20,
              })
              .catch((err) => {
                console.warn("?? getAvailableRequests failed:", err);
                return { requests: [], pagination: { hasMore: false } };
              })
          : Promise.resolve({ requests: [], pagination: { hasMore: false } }),
      ]);

      const liveRequests: Request[] = Array.isArray(socketRequests)
        ? socketRequests
        : [];
      const available: Request[] = Array.isArray(availableResult)
        ? availableResult
        : Array.isArray((availableResult as any)?.requests)
          ? (availableResult as any).requests
          : [];

      // Also fetch full history via REST so completed requests are always visible.
      // Archived completed requests are excluded here (only on Archived filter).
      let historyRequests: Request[] = [];
      try {
        const histRes = await apiClient.get("/app/requests/my-history", {
          params: { status: "all" },
        });
        historyRequests = Array.isArray(histRes.data?.requests)
          ? histRes.data.requests.filter(
              (r: Request) => !isProviderArchived(r),
            )
          : [];
      } catch (histErr) {
        console.warn("?? Could not fetch request history:", histErr);
      }

      // Available (unclaimed) first, then assigned live, then REST wins on conflicts
      // so payment/status progression stays accurate for claimed requests.
      // Archived completed requests stay out of All / Pending / Accepted / Completed.
      const merged = new Map<string, Request>();
      available.forEach((r) => merged.set(r._id, r));
      liveRequests.forEach((r) => merged.set(r._id, r));
      historyRequests.forEach((r) => merged.set(r._id, r));

      const nextRequests = Array.from(merged.values()).filter(
        (r) => !isProviderArchived(r),
      );

      const previous = requestsRef.current;
      if (hasLoadedOnce.current) {
        const prevIds = new Set(previous.map((row) => String(row._id)));
        const discoveredSearching = nextRequests.some(
          (row) =>
            row.status === "searching" && !prevIds.has(String(row._id)),
        );
        if (discoveredSearching) {
          const newSearching = nextRequests.find(
            (row) =>
              row.status === "searching" && !prevIds.has(String(row._id)),
          );
          void alertNewRequestAvailable(newSearching?._id);
        }
      }

      setRequests((prev) => {
        // Keep the existing list mounted when background sync finds no changes
        if (
          prev.length === nextRequests.length &&
          prev.every((row) => {
            const next = merged.get(row._id);
            return next && next.status === row.status;
          })
        ) {
          return prev;
        }
        return nextRequests;
      });
      requestsRef.current = nextRequests;
      hasLoadedOnce.current = true;
    } catch (error: any) {
      console.error("? Error loading requests:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.userId]);

  // Connect to socket and load initial requests
  useEffect(() => {
    if (user?.userId) {
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

      const socket = socketService.getSocket();

      const handleConnect = () => {
        loadRequests();
      };

      if (socket?.connected) {
        loadRequests();
      } else {
        socket?.on("connect", handleConnect);
      }

      return () => {
        socket?.off("connect", handleConnect);
      };
    }
  }, [user?.userId, user?.role, loadRequests]);

  // Silent background sync while focused — sockets handle realtime; this is a backup.
  useFocusEffect(
    useCallback(() => {
      if (user?.userId) {
        loadRequests();
        loadPrescriptions();
      }

      const intervalId = setInterval(() => {
        if (user?.userId) {
          loadRequests();
        }
      }, 30000);

      return () => clearInterval(intervalId);
    }, [user?.userId, loadRequests, loadPrescriptions]),
  );

  // -- Prescription upload polling -------------------------------------------
  // While any accepted pharmacy request is still waiting for a prescription,
  // poll every 8 seconds so the pharmacist sees it the moment the patient uploads.
  const prescriptionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isPharmacist) return;

    // Determine if there are any requests that need a prescription but don't have one yet
    const hasAwaitingRequests = requests.some((r) => {
      const needsPrescription =
        typeof r.ailmentCategoryId === "object" &&
        (
          !!(r.ailmentCategoryId as any)?.requiresPrescription ||
          /prescription/i.test((r.ailmentCategoryId as any)?.title ?? "")
        );
      if (!needsPrescription) return false;
      const linked = prescriptions.find((p) => {
        const pid = typeof p.requestId === "object"
          ? (p.requestId as any)?._id
          : p.requestId;
        return pid === r._id;
      });
      return !linked; // still awaiting
    });

    if (hasAwaitingRequests) {
      // Start polling if not already running
      if (!prescriptionPollRef.current) {
        prescriptionPollRef.current = setInterval(() => {
          loadPrescriptions();
        }, 8000);
      }
    } else {
      // Nothing to wait for — clear the interval
      if (prescriptionPollRef.current) {
        clearInterval(prescriptionPollRef.current);
        prescriptionPollRef.current = null;
      }
    }

    return () => {
      if (prescriptionPollRef.current) {
        clearInterval(prescriptionPollRef.current);
        prescriptionPollRef.current = null;
      }
    };
  }, [isPharmacist, requests, prescriptions, loadPrescriptions]);

  // Listen for new requests and status changes
  useEffect(() => {
    // Voice for socket newRequestAvailable is handled by useConsultationStatusAlerts.
    const handleNewRequest = (request: Request) => {
      setRequests((prev) => [
        request,
        ...prev.filter((r) => r._id !== request._id),
      ]);
    };

    const handleRequestHidden = (data: { requestId: string }) => {
      setRequests((prev) => prev.filter((req) => req._id !== data.requestId));
    };

    const handleRequestStatusChanged = async (data: {
      requestId: string;
      status: string;
      request?: Request;
    }) => {

      // WORKAROUND: If backend says cancelled but providerAccepted exists, it was actually accepted
      let correctStatus: Request["status"] = data.status as Request["status"];
      if (
        data.status === "cancelled" &&
        data.request?.timeline?.providerAccepted
      ) {
        correctStatus = "accepted";
      }

      // Status voice is handled by useConsultationStatusAlerts (tabs layout).
      setRequests((prev) => {
        // If truly cancelled (patient cancelled, no provider acceptance), remove from list
        if (correctStatus === "cancelled" || correctStatus === "expired") {
          return prev.filter((r) => r._id !== data.requestId);
        }

        // Optimistically update local state immediately for snappy UI
        const updated = prev.map((req) =>
          req._id === data.requestId
            ? { ...req, ...(data.request || {}), status: correctStatus } as Request
            : req,
        );
        const exists = updated.some((r) => r._id === data.requestId);
        if (!exists && data.request) {
          return [{ ...data.request, status: correctStatus } as Request, ...updated];
        }
        return updated;
      });

      // Also reload from server so the card has full populated data (provider details,
      // payment info, etc.) — this is what makes teleconsultation payment status visible
      // without needing to navigate away and back.
      loadRequests();
    };

    // Attach listeners to current socket
    const attachListeners = (sock: ReturnType<typeof socketService.getSocket>) => {
      if (!sock) return;
      sock.on("newRequestAvailable", handleNewRequest);
      sock.on("requestHidden", handleRequestHidden);
      sock.on("requestStatusChanged", handleRequestStatusChanged);
    };

    // Re-attach whenever the socket reconnects (new instance after disconnect)
    const handleReconnect = () => {
      const sock = socketService.getSocket();
      attachListeners(sock);
      loadRequests();
    };

    const currentSocket = socketService.getSocket();
    attachListeners(currentSocket);
    currentSocket?.on("reconnect", handleReconnect);
    currentSocket?.on("connect", handleReconnect);

    return () => {
      const sock = socketService.getSocket();
      sock?.off("newRequestAvailable", handleNewRequest);
      sock?.off("requestHidden", handleRequestHidden);
      sock?.off("requestStatusChanged", handleRequestStatusChanged);
      sock?.off("reconnect", handleReconnect);
      sock?.off("connect", handleReconnect);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.userId, user?.role, loadRequests]);

  const activeStatuses = ["accepted", "en_route", "arrived", "in_progress"];

  const loadArchivedRequests = useCallback(
    async ({ pageToLoad, append }: { pageToLoad: number; append: boolean }) => {
      try {
        if (append) setArchivedLoadingMore(true);
        else setArchivedLoading(true);

        const histRes = await apiClient.get("/app/requests/my-history", {
          params: {
            status: "archived",
            page: pageToLoad,
            limit: PAGE_SIZE,
          },
        });
        const pageItems: Request[] = Array.isArray(histRes.data?.requests)
          ? histRes.data.requests
          : [];
        const pagination = histRes.data?.pagination || {};
        const nextHasMore = Boolean(pagination.hasNextPage);
        const nextTotal =
          Number(pagination.totalItems ?? pageItems.length) || 0;

        setArchivedRequests((prev) => {
          if (!append) return pageItems;
          const seen = new Set(prev.map((item) => item._id));
          return [
            ...prev,
            ...pageItems.filter((item) => !seen.has(item._id)),
          ];
        });
        setArchivedPage(pageToLoad);
        setArchivedHasMore(nextHasMore);
        setArchivedTotal(nextTotal);
      } catch (err) {
        console.warn("?? Could not fetch archived requests:", err);
        if (!append) {
          setArchivedRequests([]);
          setArchivedHasMore(false);
          setArchivedTotal(0);
        }
      } finally {
        setArchivedLoading(false);
        setArchivedLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    if (filter === "archived") {
      loadArchivedRequests({ pageToLoad: 1, append: false });
    }
  }, [filter, loadArchivedRequests]);

  const handleFilterChange = useCallback((key: string) => {
    setFilter(
      key as "all" | "pending" | "accepted" | "completed" | "archived",
    );
  }, []);

  const handleArchiveRequest = useCallback(
    (request: Request) => {
      if (archivingId) return;
      if (request.status !== "completed" || isProviderArchived(request)) return;

      showAlertDialog(
        "Archive consultation",
        "This completed consultation will move to Archived. You can unarchive it later.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Archive",
            onPress: async () => {
              try {
                setArchivingId(request._id);
                await apiClient.post(`/app/requests/${request._id}/archive`);
                setRequests((prev) =>
                  prev.filter((item) => item._id !== request._id),
                );
                requestsRef.current = requestsRef.current.filter(
                  (item) => item._id !== request._id,
                );
              } catch (err: any) {
                showAlertDialog(
                  "Could not archive",
                  getUserFacingErrorMessage(err, "Please try again."),
                );
              } finally {
                setArchivingId(null);
              }
            },
          },
        ],
      );
    },
    [archivingId],
  );

  const handleUnarchiveRequest = useCallback(
    (request: Request) => {
      if (archivingId) return;
      if (!isProviderArchived(request)) return;

      showAlertDialog(
        "Unarchive consultation",
        "This consultation will return to your completed list.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Unarchive",
            onPress: async () => {
              try {
                setArchivingId(request._id);
                await apiClient.post(`/app/requests/${request._id}/unarchive`);
                setArchivedRequests((prev) =>
                  prev.filter((item) => item._id !== request._id),
                );
                setArchivedTotal((prev) => Math.max(0, prev - 1));
                // Refresh main list so it reappears under Completed
                loadRequests();
              } catch (err: any) {
                showAlertDialog(
                  "Could not unarchive",
                  getUserFacingErrorMessage(err, "Please try again."),
                );
              } finally {
                setArchivingId(null);
              }
            },
          },
        ],
      );
    },
    [archivingId, loadRequests],
  );

  const filteredRequests = (
    filter === "archived" ? archivedRequests : requests
  )
    .filter((r) => {
      if (filter === "archived") {
        return r.status === "completed" && isProviderArchived(r);
      }
      if (isProviderArchived(r)) return false;
      if (filter === "all")
        return r.status !== "cancelled" && r.status !== "expired";
      if (filter === "pending")
        return r.status === "searching" || r.status === "pending";
      if (filter === "accepted")
        return (
          r.status === "accepted" ||
          r.status === "payment_pending" ||
          r.status === "paid" ||
          r.status === "provider_confirmation_pending" ||
          r.status === "ready_for_call" ||
          r.status === "in_call" ||
          r.status === "in_progress" ||
          r.status === "arrived" ||
          r.status === "en_route"
        );
      if (filter === "completed") return r.status === "completed";
      return true;
    })
    .sort((a, b) => {
      // For pharmacists: bubble active delivery requests (accepted/en_route/arrived) to top
      if (isPharmacist) {
        const aActive = activeStatuses.includes(a.status) ? 0 : 1;
        const bActive = activeStatuses.includes(b.status) ? 0 : 1;
        return aActive - bActive;
      }
      return 0;
    });

  const displayedRequests =
    filter === "archived"
      ? filteredRequests
      : filteredRequests.slice(0, visibleCount);

  const hasMoreRequests =
    filter === "archived"
      ? archivedHasMore
      : visibleCount < filteredRequests.length;

  const totalShownCount =
    filter === "archived" ? archivedTotal || filteredRequests.length : filteredRequests.length;

  const handleLoadMore = useCallback(() => {
    if (filter === "archived") {
      if (archivedLoadingMore || !archivedHasMore) return;
      loadArchivedRequests({ pageToLoad: archivedPage + 1, append: true });
      return;
    }
    setVisibleCount((prev) => prev + PAGE_SIZE);
  }, [
    archivedHasMore,
    archivedLoadingMore,
    archivedPage,
    filter,
    loadArchivedRequests,
  ]);

  const renderCompletedArchiveActions = (request: Request) => {
    const archived = isProviderArchived(request);
    const busy = archivingId === request._id;

    if (archived) {
      return (
        <TouchableOpacity
          onPress={() => handleUnarchiveRequest(request)}
          disabled={busy || Boolean(archivingId)}
          style={{
            marginTop: 8,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            borderRadius: 12,
            paddingVertical: 12,
            paddingHorizontal: 12,
            backgroundColor: "rgba(187, 247, 208, 0.45)",
            borderWidth: 1,
            borderColor: "rgba(34, 197, 94, 0.35)",
            opacity: busy ? 0.7 : 1,
          }}
        >
          {busy ? (
            <ActivityIndicator size="small" color={AUTH_COLORS.green} />
          ) : (
            <Feather name="rotate-ccw" size={15} color={AUTH_COLORS.green} />
          )}
          <Text
            style={{
              fontSize: 13,
              fontWeight: "800",
              color: AUTH_COLORS.greenDark,
            }}
          >
            {busy ? "Restoring..." : "Unarchive"}
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => handleArchiveRequest(request)}
        disabled={busy || Boolean(archivingId)}
        style={{
          marginTop: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 12,
          backgroundColor: "#E5E7EB",
          borderWidth: 1,
          borderColor: "#D1D5DB",
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? (
          <ActivityIndicator size="small" color="#4B5563" />
        ) : (
          <Feather name="archive" size={15} color="#4B5563" />
        )}
        <Text style={{ fontSize: 13, fontWeight: "800", color: "#374151" }}>
          {busy ? "Archiving..." : "Archive"}
        </Text>
      </TouchableOpacity>
    );
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "searching":
      case "pending":
        return {
          bg: AUTH_COLORS.greenSoft,
          text: AUTH_COLORS.greenDark,
          icon: "clock" as const,
        };
      case "accepted":
      case "payment_pending":
      case "paid":
      case "provider_confirmation_pending":
      case "ready_for_call":
      case "in_call":
      case "in_progress":
      case "arrived":
      case "en_route":
        return {
          bg: AUTH_COLORS.greenSoft,
          text: AUTH_COLORS.greenDark,
          icon:
            status === "en_route" || status === "arrived"
              ? ("navigation" as const)
              : status === "in_call" || status === "ready_for_call"
                ? ("video" as const)
                : status === "in_progress"
                  ? ("activity" as const)
                  : ("check" as const),
        };
      case "completed":
        return {
          bg: "#F0FDF4",
          text: AUTH_COLORS.greenDark,
          icon: "check" as const,
        };
      default:
        return {
          bg: "#F3F4F6",
          text: AUTH_COLORS.textMuted,
          icon: "circle" as const,
        };
    }
  };

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

  const formatDate = (dateString?: string) => {
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

  const confirmAccept = (request: Request) => {
    if (request?.paymentMethod === "medical_aid") {
      setPendingAcceptRequest(request);
      setTimeout(() => setShowPostalAddressModal(true), 280);
      return;
    }
    handleAccept(request);
  };

  const handleProviderPostalConfirmed = () => {
    const request = pendingAcceptRequest;
    setShowPostalAddressModal(false);
    setPendingAcceptRequest(null);
    if (!request) return;
    handleAccept(request);
  };

  // Handle accept request - same as home.tsx
  const handleAccept = async (request: Request) => {
    // Double check user is available
    if (!user || !user.userId) {
      console.error("Cannot accept request: user is not available");
      Alert.alert("Error", "User session not available. Please try again.");
      return;
    }

    if (acceptInFlightRef.current || actionLoading) return;

    const currentUserId = user.userId; // Store userId to avoid issues if user becomes null

    acceptInFlightRef.current = true;
    setActionLoading({ requestId: request._id, action: "accept" });
    try {
      const { granted } = await ensureForegroundLocationPermission({
        requestIfNeeded: true,
      });
      if (!granted) {
        Alert.alert(
          "Location Permission Required",
          "Your current location is required before accepting nearby consultation requests.",
        );
        return;
      }

      const acceptProviderCoords = await resolveProviderCoordsForAccept();

      // 1) Accept on backend (assign provider)
      await socketService.acceptRequest(
        request._id,
        currentUserId,
        acceptProviderCoords,
      );

      if (request.consultationMode === "video_consultation") {
        const isCash = request.paymentMethod === "cash";
        const nextStatus = isCash ? "payment_pending" : "ready_for_call";
        setRequests((prev) =>
          prev.map((req) =>
            req._id === request._id
              ? ({ ...req, status: nextStatus } as Request)
              : req,
          ),
        );
        Alert.alert(
          "Teleconsultation Accepted",
          isCash
            ? "The patient now needs to complete eWallet payment before the consultation can continue."
            : "Medical aid consultation accepted. You can start the video call when ready — no eWallet payment is required.",
        );
        return;
      }

      // 2) Open route map immediately for house visits
      const patientCoords = getPatientLocationFromRequest(request);
      startRoute({
        ...request,
        status: "en_route" as Request["status"],
        address: {
          ...request.address,
          locality: request.address?.locality || "",
          administrative_area_level_1:
            request.address?.administrative_area_level_1 || "",
          ...(patientCoords
            ? { coordinates: patientCoords }
            : request.address?.coordinates
              ? { coordinates: request.address.coordinates }
              : {}),
        },
      } as Request);

      // 3) In background, request location and send en_route with coords (backend requires location)
      (async () => {
        try {
          // Re-check user in case it changed
          if (!user || !user.userId) {
            console.warn("User not available in background task");
            return;
          }

          const { granted: bgGranted } =
            await ensureForegroundLocationPermission({
              requestIfNeeded: false,
            });
          if (!bgGranted) {
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
        } catch (bgError: any) {
          console.warn(
            "Failed to send en_route with coords:",
            bgError?.message || bgError,
          );
        }
      })();

      // 4) Keep request visible as en_route while navigation is active
      setRequests((prev) =>
        prev.map((req) =>
          req._id === request._id
            ? ({ ...req, status: "en_route" } as Request)
            : req,
        ),
      );
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

  // Handle mark route - open route tracking modal
  const handleMarkRoute = async (request: Request) => {
    if (!user?.userId) {
      Alert.alert("Error", "User session not available. Please try again.");
      return;
    }

    const assignedProviderId = getRequestProviderId(request);
    if (assignedProviderId && assignedProviderId !== String(user.userId)) {
      console.error("State mismatch detected!", {
        assignedProviderId,
        userId: user.userId,
        providerId: request.providerId,
      });
      Alert.alert(
        "Sync Error",
        "This request is no longer assigned to you. Refreshing the list.",
        [{ text: "OK", onPress: loadRequests }],
      );
      return;
    }

    const patientCoords = getPatientLocationFromRequest(request);
    if (!patientCoords) {
      Alert.alert(
        "Location Unavailable",
        "Patient location is missing for this request. Ask the patient to update their location, then refresh.",
      );
      return;
    }

    setActionLoading({ requestId: request._id, action: "route" });
    try {

      // Open the map first so navigation never depends on the status update succeeding
      startRoute({
        ...request,
        status: "en_route" as Request["status"],
        address: {
          ...request.address,
          locality: request.address?.locality || "",
          administrative_area_level_1:
            request.address?.administrative_area_level_1 || "",
          coordinates: patientCoords,
        },
      } as Request);

      const { granted } = await ensureForegroundLocationPermission({
        requestIfNeeded: true,
      });
      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Location permission is required for live tracking, but you can still view the route.",
        );
        return;
      }

      const providerLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const providerCoords = {
        latitude: providerLocation.coords.latitude,
        longitude: providerLocation.coords.longitude,
      };

      // Only update status if it's the first time marking the route
      if (request.status === "accepted") {
        await socketService.updateRequestStatus(
          request._id,
          user.userId,
          "en_route",
          providerCoords,
        );
        setRequests((prev) =>
          prev.map((req) =>
            req._id === request._id
              ? ({ ...req, status: "en_route" } as Request)
              : req,
          ),
        );
      }
    } catch (error: any) {
      console.error("Error marking route:", error);
      // Map already open — only warn if status update failed
      Alert.alert(
        "Navigation Warning",
        error.message ||
          "Route map opened, but status update failed. You can continue navigating.",
      );
    } finally {
      setActionLoading((prev) =>
        prev?.requestId === request._id ? null : prev,
      );
    }
  };

  // Handle route completion
  const handleRouteComplete = useCallback(() => {
    try {
      // Reload requests after a small delay to ensure modal is closed first
      setTimeout(() => {
        loadRequests();
      }, 500);
    } catch (error) {
      console.error("Error in handleRouteComplete:", error);
    }
  }, [loadRequests]);

  // Handle complete request
  const handleStartConsultation = async (
    requestId: string,
    patientName: string,
  ) => {
    if (!user?.userId) return;

    setActionLoading({ requestId, action: "start" });
    try {
      await socketService.updateRequestStatus(
        requestId,
        user.userId,
        "in_progress",
        undefined,
      );

      const startedAt = new Date().toISOString();
      // Update local state immediately (incl. captured start time)
      setRequests((prev) =>
        prev.map((req) =>
          req._id === requestId
            ? ({
                ...req,
                status: "in_progress",
                timeline: {
                  ...(req.timeline || {}),
                  consultationStarted:
                    req.timeline?.consultationStarted || startedAt,
                },
              } as Request)
            : req,
        ),
      );

      Alert.alert("Consultation Started", `Consultation started for ${patientName}.`);
    } catch (error: any) {
      console.error("Error starting consultation:", error);
      Alert.alert(
        "Error",
        getUserFacingErrorMessage(error, "Failed to start consultation"),
      );
    } finally {
      setActionLoading((prev) =>
        prev?.requestId === requestId ? null : prev,
      );
    }
  };

  // Handle complete request
  const handleComplete = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    setActionLoading({ requestId, action: "complete" });
    try {
      await socketService.updateRequestStatus(
        requestId,
        user.userId,
        "completed",
        undefined,
      );

      const completedAt = new Date().toISOString();
      // Update local state (incl. captured start/complete times)
      setRequests((prev) =>
        prev.map((req) =>
          req._id === requestId
            ? ({
                ...req,
                status: "completed" as Request["status"],
                timeline: {
                  ...(req.timeline || {}),
                  consultationStarted:
                    req.timeline?.consultationStarted || completedAt,
                  consultationCompleted:
                    req.timeline?.consultationCompleted || completedAt,
                },
              } as Request)
            : req,
        ),
      );

      Alert.alert("Success", `Consultation completed for ${patientName}!`);
    } catch (error: any) {
      console.error("Error completing request:", error);
      Alert.alert(
        "Error",
        getUserFacingErrorMessage(error, "Failed to complete request"),
      );
    } finally {
      setActionLoading((prev) =>
        prev?.requestId === requestId ? null : prev,
      );
    }
  };

  const handlePaymentReceived = async (
    requestId: string,
    patientName: string,
  ) => {
    if (!user?.userId) return;

    setActionLoading({ requestId, action: "payment_received" });
    try {
      await socketService.confirmTeleconsultationPaymentReceived(
        requestId,
        user.userId,
      );

      setRequests((prev) =>
        prev.map((req) =>
          req._id === requestId
            ? ({ ...req, status: "ready_for_call" } as Request)
            : req,
        ),
      );

      Alert.alert(
        "Payment Received",
        `The call with ${patientName} is now ready to begin.`,
      );
    } catch (error: any) {
      console.error("Error confirming teleconsultation payment receipt:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to confirm payment receipt",
      );
    } finally {
      setActionLoading((prev) =>
        prev?.requestId === requestId ? null : prev,
      );
    }
  };

  // Handle decline request
  const handleDecline = async (requestId: string, patientName: string) => {
    if (!user?.userId) return;

    setActionLoading({ requestId, action: "decline" });
    try {
      await socketService.rejectRequest(requestId, user.userId);
      setRequests((prev) => prev.filter((req) => req._id !== requestId));
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
    } finally {
      setActionLoading((prev) =>
        prev?.requestId === requestId ? null : prev,
      );
    }
  };

  const handleCallAmbulance = () => {
    showAlertDialog(
      "Call Ambulance",
      "This will open your phone dialer and call 956 ambulance. Do you want to continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Call 956",
          style: "destructive",
          onPress: async () => {
            try {
              await Linking.openURL("tel:956");
            } catch (error) {
              Alert.alert(
                "Unable to open dialer",
                "Please dial 956 manually from your phone.",
              );
            }
          },
        },
      ],
      { cancelable: true },
    );
  };

  const confirmStartConsultation = (requestId: string, patientName: string) => {
    showAlertDialog(
      "Start Consultation",
      `Start consultation with ${patientName}? Status will change to in progress.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start",
          onPress: () => handleStartConsultation(requestId, patientName),
        },
      ],
      { cancelable: true },
    );
  };

  const confirmCompleteConsultation = (
    requestId: string,
    patientName: string,
  ) => {
    showAlertDialog(
      "Complete Consultation",
      `Are you sure you want to complete consultation for ${patientName}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Complete",
          onPress: () => handleComplete(requestId, patientName),
        },
      ],
      { cancelable: true },
    );
  };

  return (
    <AppScreenShell>
      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={appScreenStyles.scrollContent}
      >
        <AppHeroCard
          eyebrow={`${getGreeting()} ${getGreetingEmoji()}`}
          name="My requests"
          tagline="View and manage your consultations"
          stats={[
            {
              icon: "folder",
              label: `${Math.min(displayedRequests.length, totalShownCount)} of ${totalShownCount}`,
            },
            { icon: "filter", label: filter },
          ]}
        />

        <AppFilterChips
          filters={[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending", color: AUTH_COLORS.greenDark },
            { key: "accepted", label: "Accepted", color: AUTH_COLORS.green },
            { key: "completed", label: "Completed", color: AUTH_COLORS.green },
            { key: "archived", label: "Archived", color: AUTH_COLORS.textMuted },
          ]}
          active={filter}
          onChange={handleFilterChange}
        />

        {/* Requests List */}
        <View style={appScreenStyles.contentSection}>
          {isLoading || (filter === "archived" && archivedLoading) ? (
            <AppLoadingCard message="Loading requests..." />
          ) : displayedRequests.length === 0 ? (
            <AppEmptyState
              icon={filter === "archived" ? "archive" : "folder"}
              title={
                filter === "archived" ? "No archived requests" : "No requests"
              }
              body={
                filter === "archived"
                  ? "Completed consultations you archive will appear here."
                  : `No ${filter !== "all" ? filter + " " : ""}requests found`
              }
            />
          ) : (
            <>
            {displayedRequests.map((request) => {
              const statusStyle = getStatusStyle(request.status);
              const isCompleted = request.status === "completed";
              const patientName =
                request.patientId?.fullname || "Unknown Patient";
              const displayPatientName = isCompleted ? "Patient" : patientName;
              const displayInitials = isCompleted
                ? "P"
                : getPatientInitials(patientName);
              const ailmentName = getAilmentName(request.ailmentCategoryId);
              const fee = `N$ ${request.consultationCost ?? request.estimatedCost ?? 0}`;
              const consultationMode: "house_visit" | "video_consultation" =
                request.consultationMode === "video_consultation"
                  ? "video_consultation"
                  : "house_visit";
              const consultationModeMeta =
                consultationMode === "video_consultation"
                  ? { label: "Video", icon: "video" as const }
                  : { label: "House visit", icon: "home" as const };
              const isBusy = actionLoading?.requestId === request._id;
              const isLoadingAction = (
                action:
                  | "accept"
                  | "decline"
                  | "route"
                  | "start"
                  | "complete"
                  | "payment_received",
              ) =>
                actionLoading?.requestId === request._id &&
                actionLoading?.action === action;

              // Does this request require a prescription?
              const ailmentRequiresPrescription =
                typeof request.ailmentCategoryId === "object" &&
                (
                  !!(request.ailmentCategoryId as any)?.requiresPrescription ||
                  /prescription/i.test((request.ailmentCategoryId as any)?.title ?? "")
                );
              // Has the patient uploaded a prescription for this request yet?
              const linkedPrescription = prescriptions.find(
                (p) => {
                  const pid = typeof p.requestId === "object" ? (p.requestId as any)?._id : p.requestId;
                  return pid === request._id;
                }
              );
              const awaitingPrescription =
                isPharmacist && ailmentRequiresPrescription && !linkedPrescription;

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
              const patientPhone = canShowPatientPhone(request.status)
                ? request.patientId?.cellphoneNumber?.trim() || null
                : null;

              return (
                <View
                  key={request._id}
                  style={[
                    appScreenStyles.requestCard,
                    requestCardStyles.card,
                  ]}
                >
                  <View style={requestCardStyles.header}>
                    <View style={requestCardStyles.avatar}>
                      <Text style={requestCardStyles.avatarText}>
                        {displayInitials}
                      </Text>
                    </View>

                    <View style={requestCardStyles.headerMain}>
                      <Text style={requestCardStyles.patientName} numberOfLines={1}>
                        {displayPatientName}
                      </Text>
                      {patientPhone ? (
                        <TouchableOpacity
                          onPress={() => Linking.openURL(`tel:${patientPhone}`)}
                          style={requestCardStyles.phoneRow}
                          hitSlop={8}
                          activeOpacity={0.7}
                        >
                          <Feather name="phone" size={12} color={AUTH_COLORS.green} />
                          <Text style={requestCardStyles.phoneText} numberOfLines={1}>
                            {patientPhone}
                          </Text>
                        </TouchableOpacity>
                      ) : null}
                      <Text style={requestCardStyles.ailmentLine} numberOfLines={1}>
                        {ailmentName}
                      </Text>
                    </View>

                    <View
                      style={[
                        requestCardStyles.statusPill,
                        { backgroundColor: statusStyle.bg },
                      ]}
                    >
                      <Feather
                        name={statusStyle.icon}
                        size={11}
                        color={statusStyle.text}
                      />
                      <Text
                        style={[
                          requestCardStyles.statusText,
                          { color: statusStyle.text },
                        ]}
                        numberOfLines={1}
                      >
                        {formatStatusLabel(request.status)}
                      </Text>
                    </View>
                  </View>

                  <View style={requestCardStyles.detailsPanel}>
                    <View style={requestCardStyles.detailsRow}>
                      <View style={requestCardStyles.detailItem}>
                        <Text style={requestCardStyles.detailLabel}>Fee</Text>
                        <Text style={requestCardStyles.detailValue}>{fee}</Text>
                      </View>
                      <View style={requestCardStyles.detailDivider} />
                      <View style={requestCardStyles.detailItem}>
                        <Text style={requestCardStyles.detailLabel}>Date</Text>
                        <Text style={requestCardStyles.detailValue}>
                          {formatDate(request.createdAt)}
                        </Text>
                      </View>
                    </View>

                    <View style={requestCardStyles.modeRow}>
                      <Feather
                        name={consultationModeMeta.icon}
                        size={13}
                        color={AUTH_COLORS.greenDark}
                      />
                      <Text style={requestCardStyles.modeLabel}>
                        {consultationModeMeta.label}
                      </Text>
                    </View>

                    {addressLine ? (
                      <View style={requestCardStyles.locationRow}>
                        <Feather
                          name="map-pin"
                          size={14}
                          color={AUTH_COLORS.green}
                          style={{ marginTop: 2 }}
                        />
                        <Text style={requestCardStyles.locationText}>
                          {addressLine}
                        </Text>
                      </View>
                    ) : null}

                    {request.symptoms ? (
                      <View style={requestCardStyles.symptomsBlock}>
                        <Text style={requestCardStyles.detailLabel}>
                          Symptoms
                        </Text>
                        <Text style={requestCardStyles.symptomsText}>
                          {request.symptoms}
                        </Text>
                      </View>
                    ) : null}

                    {(request.timeline?.consultationStarted ||
                      request.timeline?.consultationCompleted) && (
                      <View style={requestCardStyles.symptomsBlock}>
                        <Text style={requestCardStyles.detailLabel}>
                          Consultation times
                        </Text>
                        {request.timeline?.consultationStarted ? (
                          <Text style={requestCardStyles.symptomsText}>
                            Started:{" "}
                            {new Date(
                              request.timeline.consultationStarted,
                            ).toLocaleString()}
                          </Text>
                        ) : null}
                        {request.timeline?.consultationCompleted ? (
                          <Text style={requestCardStyles.symptomsText}>
                            Completed:{" "}
                            {new Date(
                              request.timeline.consultationCompleted,
                            ).toLocaleString()}
                          </Text>
                        ) : null}
                      </View>
                    )}
                  </View>

                  {awaitingPrescription && (
                    <View style={requestCardStyles.infoBanner}>
                      <Feather
                        name="clock"
                        size={15}
                        color={AUTH_COLORS.greenDark}
                      />
                      <Text style={requestCardStyles.infoBannerText}>
                        Awaiting prescription upload from patient
                      </Text>
                    </View>
                  )}

                  {/* -- Inline prescription panel (pharmacist only) -- */}
                  {isPharmacist && ailmentRequiresPrescription && linkedPrescription && (() => {
                    const p = linkedPrescription;
                    const imageSource =
                      prescriptionPreviewSources[p._id] ||
                      (p.prescriptionImage
                        ? {
                            uri:
                              buildBackendAssetUrl(
                                "images",
                                p.prescriptionImage,
                              ) || "",
                          }
                        : null);
                    const isPrescriptionBusy = prescriptionLoading === p._id;
                    const statusColor =
                      p.status === "accepted" ? { bg: "#DCFCE7", text: "#166534" } :
                      p.status === "rejected"  ? { bg: "#FEE2E2", text: "#991B1B" } :
                                                 { bg: "#FEF9C3", text: "#92400E" };
                    const statusLabel =
                      p.status === "accepted" ? "Accepted" :
                      p.status === "rejected"  ? "Rejected" : "Awaiting Review";

                    return (
                      <View style={{ borderWidth: 1, borderColor: AUTH_COLORS.inputBorder, borderRadius: 14, padding: 12, marginBottom: 12, backgroundColor: AUTH_COLORS.bg }}>
                        {/* Header row */}
                        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                          <Feather name="file-text" size={15} color="#4B5563" />
                          <Text style={{ fontSize: 13, fontWeight: "700", color: "#111827", marginLeft: 6, flex: 1 }}>
                            Prescription
                          </Text>
                          <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 }}>
                            <Text style={{ fontSize: 11, fontWeight: "700", color: statusColor.text }}>{statusLabel}</Text>
                          </View>
                        </View>

                        {/* Image preview */}
                        {p.prescriptionImage && p.fileType === "image" && imageSource?.uri ? (
                          <TouchableOpacity
                            onPress={async () => {
                              const url = buildBackendAssetUrl(
                                "images",
                                p.prescriptionImage,
                              );
                              if (!url) return;
                              const source = await attachAuthToAssetUrl(url);
                              setImageViewerSource(source);
                            }}
                            activeOpacity={0.85}
                            style={{ marginBottom: 10 }}
                          >
                            <Image
                              source={imageSource}
                              style={{ width: "100%", height: 160, borderRadius: 8, backgroundColor: "#F3F4F6" }}
                              resizeMode="cover"
                            />
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>
                              <Feather name="zoom-in" size={12} color="#6B7280" />
                              <Text style={{ fontSize: 11, color: "#6B7280" }}>Tap to view full size</Text>
                            </View>
                          </TouchableOpacity>
                        ) : null}

                        {/* PDF button */}
                        {p.prescriptionImage && p.fileType === "pdf" && (
                          <TouchableOpacity
                            onPress={async () => {
                              const url = buildBackendAssetUrl("images", p.prescriptionImage);
                              if (!url) return;
                              try {
                                await downloadPrescriptionFile({
                                  url,
                                  fileType: "pdf",
                                  filenameHint: p.prescriptionImage,
                                });
                              } catch {
                                try {
                                  const authed = await withAccessTokenQuery(url);
                                  await WebBrowser.openBrowserAsync(authed);
                                } catch {
                                  Alert.alert("Error", "Could not open PDF.");
                                }
                              }
                            }}
                            activeOpacity={0.8}
                            style={{ backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: AUTH_COLORS.inputBorder, gap: 10 }}
                          >
                            <Feather name="file-text" size={20} color={AUTH_COLORS.greenDark} />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: "700", color: AUTH_COLORS.greenDark }}>PDF Prescription</Text>
                              <Text style={{ fontSize: 11, color: AUTH_COLORS.textMuted, marginTop: 2 }}>Tap to open / download</Text>
                            </View>
                            <Feather name="download" size={16} color={AUTH_COLORS.greenDark} />
                          </TouchableOpacity>
                        )}

                        {/* Rejection reason */}
                        {p.status === "rejected" && p.rejectionReason && (
                          <View style={{ backgroundColor: "#FEF2F2", borderRadius: 8, padding: 8, marginBottom: 10 }}>
                            <Text style={{ fontSize: 12, color: "#991B1B" }}>Reason: {p.rejectionReason}</Text>
                          </View>
                        )}

                        {/* Accept / Reject buttons — only when pending and image present */}
                        {p.status === "pending_review" && p.prescriptionImage && (
                          <View style={{ flexDirection: "row", gap: 10 }}>
                            <TouchableOpacity
                              onPress={() => { setRejectTarget({ prescriptionId: p._id, patientName }); setRejectModalVisible(true); }}
                              disabled={isPrescriptionBusy}
                              style={{ flex: 1, backgroundColor: AUTH_COLORS.white, borderRadius: 999, paddingVertical: 11, alignItems: "center", borderWidth: 1.5, borderColor: "#FECACA" }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "700", color: "#DC2626" }}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleAcceptPrescription(p._id)}
                              disabled={isPrescriptionBusy}
                              style={{ flex: 2, backgroundColor: AUTH_COLORS.green, borderRadius: 999, paddingVertical: 11, alignItems: "center" }}
                            >
                              {isPrescriptionBusy ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>Accept Prescription</Text>
                              )}
                            </TouchableOpacity>
                          </View>
                        )}

                        {p.status === "accepted" && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Feather name="check-circle" size={14} color="#16A34A" />
                            <Text style={{ fontSize: 12, fontWeight: "600", color: "#166534" }}>Prescription accepted — you can now start delivery</Text>
                          </View>
                        )}
                      </View>
                    );
                  })()}

                  {/* Action buttons — pharmacy-aware */}
                  {request.consultationMode === "video_consultation" ? (
                    /* -- VIDEO CONSULTATION FLOW ------------------------------- */
                    <>
                      {(request.status === "searching" ||
                        request.status === "pending") && (
                        <View className="flex-row" style={{ gap: 10 }}>
                          <TouchableOpacity
                            onPress={() =>
                              handleDecline(request._id, patientName)
                            }
                            disabled={isBusy}
                            style={requestCardStyles.dangerBtn}
                          >
                            {isLoadingAction("decline") ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Text style={requestCardStyles.dangerBtnText}>
                                Decline
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmAccept(request)}
                            disabled={isBusy}
                            style={[
                              requestCardStyles.acceptBtn,
                              isLoadingAction("accept") ? { opacity: 0.7 } : null,
                            ]}
                          >
                            {isLoadingAction("accept") ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={requestCardStyles.primaryBtnText}>
                                Accept
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {request.paymentMethod === "cash" &&
                        ["accepted", "payment_pending"].includes(
                          request.status,
                        ) && (
                        <View
                          style={[requestCardStyles.statusNote, { gap: 8 }]}
                        >
                          <ActivityIndicator size="small" color={AUTH_COLORS.green} />
                          <Text style={requestCardStyles.statusNoteText}>
                            Waiting for patient to confirm payment...
                          </Text>
                        </View>
                      )}

                      {request.paymentMethod === "cash" &&
                        request.status === "provider_confirmation_pending" && (
                        <TouchableOpacity
                          onPress={() =>
                            handlePaymentReceived(request._id, patientName)
                          }
                          disabled={isBusy}
                          style={requestCardStyles.primaryBtn}
                        >
                          {isLoadingAction("payment_received") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={requestCardStyles.primaryBtnText}>
                              Confirm Payment Received
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {["ready_for_call", "in_call"].includes(
                        request.status,
                      ) && (
                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname:
                                "/(app)/(provider)/teleconsultation-call",
                              params: { requestId: request._id },
                            })
                          }
                          style={[requestCardStyles.primaryBtn, { gap: 8 }]}
                        >
                          <Feather name="video" size={16} color="#FFFFFF" />
                          <Text style={requestCardStyles.primaryBtnText}>
                            {request.status === "in_call"
                              ? "Return to Call"
                              : "Join Call"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {request.status === "completed" && (
                        <>
                          <View
                            style={[requestCardStyles.statusNote, { gap: 6 }]}
                          >
                            <Feather
                              name="check-circle"
                              size={14}
                              color="#16A34A"
                            />
                            <Text style={requestCardStyles.statusNoteText}>
                              Consultation Completed
                            </Text>
                          </View>
                          {renderCompletedArchiveActions(request)}
                        </>
                      )}

                      {/* Same rules as house visit: in_call / in_progress, or completed within 24h */}
                      <ProviderPrescriptionPanel
                        requestId={request._id}
                        requestStatus={request.status}
                        consultationCompletedAt={
                          request.timeline?.consultationCompleted || null
                        }
                        requestUpdatedAt={
                          request.updatedAt || request.createdAt
                        }
                        canIssue={canIssueClinicalPrescription}
                      />
                    </>
                  ) : isPharmacist ? (
                    /* -- PHARMACIST / PRESCRIPTION DELIVERY FLOW --------------- */
                    <>
                      {(request.status === "searching" || request.status === "pending") && (
                        <View style={requestCardStyles.infoBanner}>
                          <Text style={requestCardStyles.infoBannerText}>
                            Waiting for patient to upload prescription
                          </Text>
                        </View>
                      )}

                      {request.status === "accepted" && (() => {
                        const prescriptionAccepted = linkedPrescription?.status === "accepted";
                        const prescriptionRejected = linkedPrescription?.status === "rejected";
                        const prescriptionPending = linkedPrescription?.status === "pending_review";

                        if (prescriptionRejected) {
                          return (
                            <View style={{ backgroundColor: "#FEF2F2", borderRadius: 8, borderWidth: 1, borderColor: "#FECACA", padding: 12, flexDirection: "row", alignItems: "center", gap: 8 }}>
                              <Feather name="x-circle" size={15} color="#DC2626" />
                              <Text style={{ fontSize: 13, fontWeight: "600", color: "#DC2626", flex: 1 }}>
                                Prescription rejected — patient must re-upload before delivery can start
                              </Text>
                            </View>
                          );
                        }

                        if (prescriptionPending || awaitingPrescription) {
                          return (
                            <View style={{ backgroundColor: "#F3F4F6", borderRadius: 10, paddingVertical: 13, paddingHorizontal: 16, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 8, opacity: 0.6 }}>
                              <Feather name="lock" size={15} color="#6B7280" />
                              <Text style={{ fontSize: 13, fontWeight: "700", color: "#6B7280" }}>
                                {prescriptionPending ? "Accept prescription above to start delivery" : "Awaiting prescription upload"}
                              </Text>
                            </View>
                          );
                        }

                        return (
                          <TouchableOpacity
                            onPress={() => handleMarkRoute(request)}
                            disabled={isBusy || !prescriptionAccepted}
                            style={[requestCardStyles.primaryBtn, { gap: 8, opacity: (isBusy || !prescriptionAccepted) ? 0.5 : 1 }]}
                          >
                            {isLoadingAction("route") ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Feather name="navigation" size={16} color="#FFFFFF" />
                                <Text style={requestCardStyles.primaryBtnText}>Start Delivery</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        );
                      })()}

                      {request.status === "en_route" && (
                        <TouchableOpacity
                          onPress={() => handleMarkRoute(request)}
                          disabled={isBusy}
                          style={[requestCardStyles.primaryBtn, { gap: 8, opacity: isBusy ? 0.5 : 1 }]}
                        >
                          {isLoadingAction("route") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Feather name="navigation" size={16} color="#FFFFFF" />
                              <Text style={requestCardStyles.primaryBtnText}>
                                Continue Navigation
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "arrived" && (
                        <TouchableOpacity
                          onPress={() => confirmCompleteConsultation(request._id, patientName)}
                          disabled={isBusy}
                          style={requestCardStyles.primaryBtn}
                        >
                          {isLoadingAction("complete") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={requestCardStyles.primaryBtnText}>Complete Delivery</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "in_progress" && (
                        <TouchableOpacity
                          onPress={() => confirmCompleteConsultation(request._id, patientName)}
                          disabled={isBusy}
                          style={requestCardStyles.primaryBtn}
                        >
                          {isLoadingAction("complete") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={requestCardStyles.primaryBtnText}>Complete Delivery</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "completed" && (
                        <>
                          <View style={[requestCardStyles.statusNote, { gap: 6 }]}>
                            <Feather name="check-circle" size={14} color="#16A34A" />
                            <Text style={requestCardStyles.statusNoteText}>Delivery Completed</Text>
                          </View>
                          {renderCompletedArchiveActions(request)}
                        </>
                      )}
                    </>
                  ) : (
                    /* -- NORMAL CONSULTATION FLOW ------------------------------- */
                    <>
                      {(request.status === "searching" || request.status === "pending") && (
                        <View className="flex-row" style={{ gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleDecline(request._id, patientName)}
                            disabled={isBusy}
                            style={requestCardStyles.dangerBtn}
                          >
                            {isLoadingAction("decline") ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Text style={requestCardStyles.dangerBtnText}>Decline</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => confirmAccept(request)}
                            disabled={isBusy}
                            style={[
                              requestCardStyles.acceptBtn,
                              isLoadingAction("accept") ? { opacity: 0.7 } : null,
                            ]}
                          >
                            {isLoadingAction("accept") ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text style={requestCardStyles.primaryBtnText}>Accept</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {request.status === "accepted" && (
                        <TouchableOpacity
                          onPress={() => handleMarkRoute(request)}
                          disabled={isBusy}
                          style={[requestCardStyles.primaryBtn, { gap: 8 }]}
                        >
                          {isLoadingAction("route") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Feather name="navigation" size={16} color="#FFFFFF" />
                              <Text style={requestCardStyles.primaryBtnText}>Navigate to Patient</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "en_route" && (
                        <TouchableOpacity
                          onPress={() => handleMarkRoute(request)}
                          disabled={isBusy}
                          style={[requestCardStyles.primaryBtn, { gap: 8, opacity: isBusy ? 0.5 : 1 }]}
                        >
                          {isLoadingAction("route") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Feather name="navigation" size={16} color="#FFFFFF" />
                              <Text style={requestCardStyles.primaryBtnText}>
                                Continue Navigation
                              </Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "arrived" && (
                        <TouchableOpacity
                          onPress={() => confirmStartConsultation(request._id, patientName)}
                          disabled={isBusy}
                          style={requestCardStyles.primaryBtn}
                        >
                          {isLoadingAction("start") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={requestCardStyles.primaryBtnText}>Start Consultation</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "in_progress" && (
                        <TouchableOpacity
                          onPress={() => confirmCompleteConsultation(request._id, patientName)}
                          disabled={isBusy}
                          style={requestCardStyles.primaryBtn}
                        >
                          {isLoadingAction("complete") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={requestCardStyles.primaryBtnText}>Complete Consultation</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {/* Cash only: waiting for patient eWallet payment */}
                      {request.paymentMethod === "cash" &&
                        request.status === "payment_pending" && (
                        <View style={[requestCardStyles.statusNote, { gap: 8 }]}>
                          <ActivityIndicator size="small" color={AUTH_COLORS.green} />
                          <Text style={requestCardStyles.statusNoteText}>Waiting for patient to confirm payment...</Text>
                        </View>
                      )}

                      {/* Cash only: patient marked paid — provider confirms EFT receipt */}
                      {request.paymentMethod === "cash" &&
                        request.status === "provider_confirmation_pending" && (
                        <TouchableOpacity
                          onPress={() => handlePaymentReceived(request._id, patientName)}
                          disabled={isBusy}
                          style={requestCardStyles.primaryBtn}
                        >
                          {isLoadingAction("payment_received") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text style={requestCardStyles.primaryBtnText}>Confirm Payment Received</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {["ready_for_call", "in_call"].includes(request.status) && (
                        <TouchableOpacity
                          onPress={() =>
                            router.push({
                              pathname:
                                "/(app)/(provider)/teleconsultation-call",
                              params: { requestId: request._id },
                            })
                          }
                          style={[requestCardStyles.primaryBtn, { gap: 8 }]}
                        >
                          <Feather name="video" size={16} color="#FFFFFF" />
                          <Text style={requestCardStyles.primaryBtnText}>
                            {request.status === "in_call"
                              ? "Return to Call"
                              : "Join Call"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {request.status === "completed" && (
                        <>
                          <View style={[requestCardStyles.statusNote, { gap: 6 }]}>
                            <Feather name="check-circle" size={14} color="#16A34A" />
                            <Text style={requestCardStyles.statusNoteText}>Consultation Completed</Text>
                          </View>
                          {renderCompletedArchiveActions(request)}
                        </>
                      )}

                      <ProviderPrescriptionPanel
                        requestId={request._id}
                        requestStatus={request.status}
                        consultationCompletedAt={
                          request.timeline?.consultationCompleted || null
                        }
                        requestUpdatedAt={request.updatedAt || request.createdAt}
                        canIssue={canIssueClinicalPrescription}
                      />
                    </>
                  )}
                </View>
              );
            })}

            {(hasMoreRequests || totalShownCount > PAGE_SIZE) && (
              <View style={{ marginTop: 12, marginBottom: 8, gap: 12 }}>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: AUTH_COLORS.inputBorder,
                    }}
                  />
                  <Text
                    style={{
                      fontSize: 11,
                      fontWeight: "700",
                      color: AUTH_COLORS.textMuted,
                    }}
                  >
                    Showing {displayedRequests.length} of {totalShownCount}
                  </Text>
                  <View
                    style={{
                      flex: 1,
                      height: 1,
                      backgroundColor: AUTH_COLORS.inputBorder,
                    }}
                  />
                </View>

                {hasMoreRequests ? (
                  <TouchableOpacity
                    onPress={handleLoadMore}
                    disabled={
                      filter === "archived" ? archivedLoadingMore : false
                    }
                    style={{
                      alignSelf: "center",
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                      backgroundColor: AUTH_COLORS.green,
                      borderRadius: 12,
                      paddingHorizontal: 18,
                      paddingVertical: 12,
                      opacity:
                        filter === "archived" && archivedLoadingMore
                          ? 0.7
                          : 1,
                    }}
                  >
                    {filter === "archived" && archivedLoadingMore ? (
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
                    <Text
                      style={{
                        color: AUTH_COLORS.white,
                        fontSize: 13,
                        fontWeight: "800",
                      }}
                    >
                      {filter === "archived" && archivedLoadingMore
                        ? "Loading..."
                        : "Load more"}
                    </Text>
                  </TouchableOpacity>
                ) : totalShownCount > PAGE_SIZE ? (
                  <Text
                    style={{
                      textAlign: "center",
                      fontSize: 12,
                      fontWeight: "600",
                      color: AUTH_COLORS.textMuted,
                    }}
                  >
                    All requests loaded
                  </Text>
                ) : null}
              </View>
            )}
            </>
          )}
        </View>
      </ScrollView>

      {/* Full-screen image viewer */}
      <Modal
        visible={!!imageViewerSource}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerSource(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setImageViewerSource(null)}
          activeOpacity={1}
        >
          {/* Close button */}
          <View style={{ position: "absolute", top: 52, right: 20, zIndex: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, padding: 10 }}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </View>
          {imageViewerSource && (
            <Image
              source={imageViewerSource}
              style={{ width: "100%", height: "80%" }}
              resizeMode="contain"
            />
          )}
          <Text style={{ color: "#9CA3AF", fontSize: 12, marginTop: 12 }}>Tap to close</Text>
        </TouchableOpacity>
      </Modal>

      {/* Reject Prescription Modal */}
      <Modal
        visible={rejectModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => { setRejectModalVisible(false); setRejectReason(""); setRejectTarget(null); }}
         >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
          <View style={{ backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 }}>
            <Text style={{ fontSize: 17, fontWeight: "700", color: "#111827", marginBottom: 4 }}>
              Reject Prescription
            </Text>
            {rejectTarget && (
              <Text style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
                Rejecting prescription for {rejectTarget.patientName}. The patient will be asked to re-upload.
              </Text>
            )}
            <TextInput
              placeholder="Reason (optional) — e.g. image is unclear"
              placeholderTextColor="#9CA3AF"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
              numberOfLines={3}
              style={withIosMultilineTextInputStyle({
                borderWidth: 1,
                borderColor: "#E5E7EB",
                borderRadius: 10,
                padding: 12,
                fontSize: 14,
                color: "#111827",
                minHeight: 72,
                textAlignVertical: "top",
                marginBottom: 16,
              })}
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity
                onPress={() => { setRejectModalVisible(false); setRejectReason(""); setRejectTarget(null); }}
                style={{ flex: 1, backgroundColor: "#F3F4F6", borderRadius: 10, paddingVertical: 13, alignItems: "center" }}
              >
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#374151" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleRejectPrescription}
                disabled={prescriptionLoading === rejectTarget?.prescriptionId}
                style={{
                  flex: 1,
                  backgroundColor: "#EF4444",
                  borderRadius: 10,
                  paddingVertical: 13,
                  alignItems: "center",
                  opacity:
                    prescriptionLoading === rejectTarget?.prescriptionId
                      ? 0.7
                      : 1,
                }}
              >
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "700",
                    color: "#FFFFFF",
                  }}
                >
                  Confirm Reject
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

    </AppScreenShell>
  );
}

const requestCardStyles = StyleSheet.create({
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
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
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
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  infoBannerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    lineHeight: 18,
  },
  primaryBtn: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: AUTH_COLORS.green,
  },
  primaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: AUTH_COLORS.white,
  },
  secondaryBtn: {
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  dangerBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  dangerBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: AUTH_COLORS.error,
  },
  acceptBtn: {
    flex: 1,
    borderRadius: 999,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AUTH_COLORS.green,
  },
  statusNote: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  statusNoteText: {
    fontSize: 13,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
});

