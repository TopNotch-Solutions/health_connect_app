import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import { useFocusEffect, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { iosInputIconSize, withIosInputContainerStyle, withIosMultilineTextInputStyle, withIosOtpTextInputStyle, withIosStandaloneTextInputStyle, withIosTextInputStyle } from "../../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../../components/AppTextInput";
import { ActivityIndicator, Alert, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  getPatientLocationFromRequest,
  getRequestProviderId,
} from "../../../lib/coordinate";
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
} from "../../../components/app/AppScreenUI";
import { useAuth } from "../../../context/AuthContext";
import { useRoute } from "../../../context/RouteContext";
import apiClient from "../../../lib/api";
import { buildBackendAssetUrl } from "../../../lib/backend";
import { ensureForegroundLocationPermission } from "../../../lib/locationPermission";
import socketService from "../../../lib/socket";
import ProviderPrescriptionPanel from "../../../components/(provider)/ProviderPrescriptionPanel";

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

export default function ProviderRequests() {
  const [filter, setFilter] = useState<
    "all" | "pending" | "accepted" | "completed"
  >("all");
  const [requests, setRequests] = useState<Request[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const { startRoute } = useRoute();
  const { user } = useAuth();
  const router = useRouter();

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
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);

  const loadPrescriptions = useCallback(async () => {
    if (!isPharmacist) return;
    try {
      const res = await apiClient.get("/app/prescription/pharmacist/all");
      setPrescriptions(res.data.prescriptions || []);
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
      console.log("📥 Fetching provider requests for:", user.userId);

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
          "⚠️ Could not get provider location for available requests:",
          locErr,
        );
      }

      const [socketRequests, availableRequests] = await Promise.all([
        socketService.getProviderRequests(user.userId).catch((err) => {
          console.warn("⚠️ getProviderRequests failed:", err);
          return [];
        }),
        providerLocation
          ? socketService
              .getAvailableRequests(user.userId, providerLocation)
              .catch((err) => {
                console.warn("⚠️ getAvailableRequests failed:", err);
                return [];
              })
          : Promise.resolve([]),
      ]);

      const liveRequests: Request[] = Array.isArray(socketRequests)
        ? socketRequests
        : [];
      const available: Request[] = Array.isArray(availableRequests)
        ? availableRequests
        : [];

      // Also fetch full history via REST so completed requests are always visible
      let historyRequests: Request[] = [];
      try {
        const histRes = await apiClient.get("/app/requests/my-history");
        historyRequests = Array.isArray(histRes.data?.requests)
          ? histRes.data.requests
          : [];
      } catch (histErr) {
        console.warn("⚠️ Could not fetch request history:", histErr);
      }

      // Available (unclaimed) first, then assigned live, then REST wins on conflicts
      // so payment/status progression stays accurate for claimed requests.
      const merged = new Map<string, Request>();
      available.forEach((r) => merged.set(r._id, r));
      liveRequests.forEach((r) => merged.set(r._id, r));
      historyRequests.forEach((r) => merged.set(r._id, r));

      console.log("✅ Merged requests:", merged.size, {
        available: available.length,
        assigned: liveRequests.length,
        history: historyRequests.length,
      });
      setRequests(Array.from(merged.values()));
      hasLoadedOnce.current = true;
    } catch (error: any) {
      console.error("❌ Error loading requests:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.userId]);

  // Connect to socket and load initial requests
  useEffect(() => {
    if (user?.userId) {
      console.log("🔌 Connecting socket for requests tab");
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
        console.log("✅ Socket connected, loading requests");
        loadRequests();
      };

      if (socket?.connected) {
        console.log("✅ Socket already connected");
        loadRequests();
      } else {
        socket?.on("connect", handleConnect);
      }

      return () => {
        socket?.off("connect", handleConnect);
      };
    }
  }, [user?.userId, user?.role, loadRequests]);

  // Refresh requests when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (user?.userId) {
        loadRequests();
        loadPrescriptions();
      }

      // Poll every 10 seconds while the screen is focused so payment status
      // changes (payment_pending → provider_confirmation_pending → ready_for_call)
      // are picked up immediately without needing a socket event.
      const intervalId = setInterval(() => {
        if (user?.userId) {
          loadRequests();
        }
      }, 10000);

      return () => clearInterval(intervalId);
    }, [user?.userId, loadRequests, loadPrescriptions]),
  );

  // ── Prescription upload polling ───────────────────────────────────────────
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
    const handleNewRequest = (request: Request) => {
      console.log("📨 New request available:", request);
      setRequests((prev) => [
        request,
        ...prev.filter((r) => r._id !== request._id),
      ]);
    };

    const handleRequestHidden = (data: { requestId: string }) => {
      console.log("🚫 Request hidden:", data.requestId);
      setRequests((prev) => prev.filter((req) => req._id !== data.requestId));
    };

    const handleRequestStatusChanged = async (data: {
      requestId: string;
      status: string;
      request?: Request;
    }) => {
      console.log("📊 Request status changed:", data);

      // WORKAROUND: If backend says cancelled but providerAccepted exists, it was actually accepted
      let correctStatus: Request["status"] = data.status as Request["status"];
      if (
        data.status === "cancelled" &&
        data.request?.timeline?.providerAccepted
      ) {
        correctStatus = "accepted";
      }

      // If truly cancelled (patient cancelled, no provider acceptance), remove from list
      if (correctStatus === "cancelled" || correctStatus === "expired") {
        setRequests((prev) => prev.filter((r) => r._id !== data.requestId));
        return;
      }

      // Optimistically update local state immediately for snappy UI
      setRequests((prev) => {
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

  const filteredRequests = requests
    .filter((r) => {
      if (filter === "all") return r.status !== "cancelled" && r.status !== "expired";
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

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "searching":
      case "pending":
        // Pending — amber
        return {
          bg: "#FEF3C7",
          text: "#B45309",
          icon: "clock" as const,
          accent: "#F59E0B",
          cardBg: "#FFFBEB",
          cardBorder: "#FCD34D",
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
        // Accepted / in progress — blue
        return {
          bg: "#DBEAFE",
          text: "#1D4ED8",
          icon:
            status === "en_route" || status === "arrived"
              ? ("navigation" as const)
              : status === "in_call" || status === "ready_for_call"
                ? ("video" as const)
                : status === "in_progress"
                  ? ("activity" as const)
                  : ("check-circle" as const),
          accent: "#2563EB",
          cardBg: "#EFF6FF",
          cardBorder: "#93C5FD",
        };
      case "completed":
        // Completed — green
        return {
          bg: "#DCFCE7",
          text: "#15803D",
          icon: "check-square" as const,
          accent: AUTH_COLORS.green,
          cardBg: "#F0FDF4",
          cardBorder: "#86EFAC",
        };
      default:
        return {
          bg: "#F3F4F6",
          text: "#4B5563",
          icon: "circle" as const,
          accent: "#9CA3AF",
          cardBg: AUTH_COLORS.white,
          cardBorder: AUTH_COLORS.inputBorder,
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

  // Handle accept request - same as home.tsx
  const handleAccept = async (request: Request) => {
    // Double check user is available
    if (!user || !user.userId) {
      console.error("Cannot accept request: user is not available");
      Alert.alert("Error", "User session not available. Please try again.");
      return;
    }

    const currentUserId = user.userId; // Store userId to avoid issues if user becomes null

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

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const acceptProviderCoords = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };

      // 1) Accept on backend (assign provider)
      await socketService.acceptRequest(
        request._id,
        currentUserId,
        acceptProviderCoords,
      );

      if (request.consultationMode === "video_consultation") {
        setRequests((prev) =>
          prev.map((req) =>
            req._id === request._id
              ? ({ ...req, status: "payment_pending" } as Request)
              : req,
          ),
        );
        Alert.alert(
          "Teleconsultation Accepted",
          "The patient now needs to complete payment before the consultation can continue.",
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
          console.log("✅ Sent en_route with provider coordinates");
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
      Alert.alert("Error", error.message || "Failed to accept request");
    } finally {
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
      console.log("🚗 Opening route modal for request:", request._id);

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
    console.log("✅ Route completed");
    try {
      // Reload requests after a small delay to ensure modal is closed first
      setTimeout(() => {
        console.log("🔄 Reloading requests after route completion");
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
      console.log("▶️ Starting consultation:", requestId);
      await socketService.updateRequestStatus(
        requestId,
        user.userId,
        "in_progress",
        undefined,
      );

      // Update local state immediately
      setRequests((prev) =>
        prev.map((req) =>
          req._id === requestId
            ? ({ ...req, status: "in_progress" } as Request)
            : req,
        ),
      );

      Alert.alert("Consultation Started", `Consultation started for ${patientName}.`);
    } catch (error: any) {
      console.error("Error starting consultation:", error);
      Alert.alert("Error", error.message || "Failed to start consultation");
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
      console.log("✅ Completing request:", requestId);
      await socketService.updateRequestStatus(
        requestId,
        user.userId,
        "completed",
        undefined,
      );

      // Update local state
      setRequests((prev) =>
        prev.map((req) =>
          req._id === requestId ? { ...req, status: "completed" as Request["status"] } as Request : req,
        ),
      );

      Alert.alert("Success", `Consultation completed for ${patientName}!`);
    } catch (error: any) {
      console.error("Error completing request:", error);
      Alert.alert("Error", error.message || "Failed to complete request");
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
      Alert.alert("Error", error.message || "Failed to decline request");
    } finally {
      setActionLoading((prev) =>
        prev?.requestId === requestId ? null : prev,
      );
    }
  };

  const handleCallAmbulance = () => {
    Alert.alert(
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
    Alert.alert(
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
    Alert.alert(
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
            { icon: "folder", label: `${filteredRequests.length} shown` },
            { icon: "filter", label: filter },
          ]}
        />

        <AppFilterChips
          filters={[
            { key: "all", label: "All" },
            { key: "pending", label: "Pending", color: "#F59E0B" },
            { key: "accepted", label: "Accepted", color: "#2563EB" },
            { key: "completed", label: "Completed", color: AUTH_COLORS.green },
          ]}
          active={filter}
          onChange={(key) => setFilter(key as typeof filter)}
        />

        {/* Requests List */}
        <View style={appScreenStyles.contentSection}>
          {isLoading ? (
            <AppLoadingCard message="Loading requests…" />
          ) : filteredRequests.length === 0 ? (
            <AppEmptyState
              icon="folder"
              title="No requests"
              body={`No ${filter !== "all" ? filter + " " : ""}requests found`}
            />
          ) : (
            filteredRequests.map((request) => {
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
                  ? {
                      label: "Video Consultation",
                      icon: "video" as const,
                      color: "#0369A1",
                      soft: "#E0F2FE",
                    }
                  : {
                      label: "House Visit",
                      icon: "home" as const,
                      color: AUTH_COLORS.greenDark,
                      soft: AUTH_COLORS.greenSoft,
                    };
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
              const patientPhone = !isCompleted
                ? request.patientId?.cellphoneNumber?.trim() || null
                : null;

              return (
                <View
                  key={request._id}
                  style={[
                    appScreenStyles.requestCard,
                    requestCardStyles.card,
                    {
                      backgroundColor: statusStyle.cardBg,
                      borderColor: statusStyle.cardBorder,
                    },
                  ]}
                >
                  <View
                    style={[
                      requestCardStyles.accentBar,
                      { backgroundColor: statusStyle.accent },
                    ]}
                  />

                  {/* Header */}
                  <View style={requestCardStyles.header}>
                    <View
                      style={[
                        requestCardStyles.avatar,
                        { backgroundColor: statusStyle.bg },
                      ]}
                    >
                      <Text
                        style={[
                          requestCardStyles.avatarText,
                          { color: statusStyle.text },
                        ]}
                      >
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

                  {/* Details panel */}
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

                    <View style={requestCardStyles.detailsSeparator} />

                    <View style={requestCardStyles.modeRow}>
                      <View
                        style={[
                          requestCardStyles.modeIconWrap,
                          { backgroundColor: consultationModeMeta.soft },
                        ]}
                      >
                        <Feather
                          name={consultationModeMeta.icon}
                          size={14}
                          color={consultationModeMeta.color}
                        />
                      </View>
                      <Text
                        style={[
                          requestCardStyles.modeLabel,
                          { color: consultationModeMeta.color },
                        ]}
                      >
                        {consultationModeMeta.label}
                      </Text>
                    </View>

                    {addressLine ? (
                      <>
                        <View style={requestCardStyles.detailsSeparator} />
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
                      </>
                    ) : null}

                    {request.symptoms ? (
                      <>
                        <View style={requestCardStyles.detailsSeparator} />
                        <View style={requestCardStyles.symptomsBlock}>
                          <Text style={requestCardStyles.detailLabel}>
                            Symptoms
                          </Text>
                          <Text style={requestCardStyles.symptomsText}>
                            {request.symptoms}
                          </Text>
                        </View>
                      </>
                    ) : null}
                  </View>

                  {/* Awaiting prescription upload banner */}
                  {awaitingPrescription && (
                    <View style={{
                      backgroundColor: "#FEF9C3",
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "#FDE68A",
                      padding: 10,
                      marginBottom: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}>
                      <Feather name="clock" size={15} color="#92400E" />
                      <Text style={{ fontSize: 13, fontWeight: "600", color: "#92400E", flex: 1 }}>
                        Awaiting prescription upload from patient
                      </Text>
                    </View>
                  )}

                  {/* ── Inline prescription panel (pharmacist only) ── */}
                  {isPharmacist && ailmentRequiresPrescription && linkedPrescription && (() => {
                    const p = linkedPrescription;
                    const imageUrl = buildBackendAssetUrl("images", p.prescriptionImage);
                    const isPrescriptionBusy = prescriptionLoading === p._id;
                    const statusColor =
                      p.status === "accepted" ? { bg: "#DCFCE7", text: "#166534" } :
                      p.status === "rejected"  ? { bg: "#FEE2E2", text: "#991B1B" } :
                                                 { bg: "#FEF9C3", text: "#92400E" };
                    const statusLabel =
                      p.status === "accepted" ? "Accepted" :
                      p.status === "rejected"  ? "Rejected" : "Awaiting Review";

                    return (
                      <View style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, marginBottom: 12, backgroundColor: "#FAFAFA" }}>
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
                        {p.prescriptionImage && p.fileType === "image" && imageUrl && (
                          <TouchableOpacity onPress={() => setImageViewerUrl(imageUrl)} activeOpacity={0.85} style={{ marginBottom: 10 }}>
                            <Image
                              source={{ uri: imageUrl }}
                              style={{ width: "100%", height: 160, borderRadius: 8, backgroundColor: "#F3F4F6" }}
                              resizeMode="cover"
                            />
                            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 4 }}>
                              <Feather name="zoom-in" size={12} color="#6B7280" />
                              <Text style={{ fontSize: 11, color: "#6B7280" }}>Tap to view full size</Text>
                            </View>
                          </TouchableOpacity>
                        )}

                        {/* PDF button */}
                        {p.prescriptionImage && p.fileType === "pdf" && (
                          <TouchableOpacity
                            onPress={async () => {
                              const url = buildBackendAssetUrl("images", p.prescriptionImage);
                              if (!url) return;
                              try { await WebBrowser.openBrowserAsync(url); }
                              catch { Alert.alert("Error", "Could not open PDF."); }
                            }}
                            activeOpacity={0.8}
                            style={{ backgroundColor: "#EFF6FF", borderRadius: 8, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 10, borderWidth: 1, borderColor: "#BFDBFE", gap: 10 }}
                          >
                            <Feather name="file-text" size={20} color="#2563EB" />
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: "700", color: "#1D4ED8" }}>PDF Prescription</Text>
                              <Text style={{ fontSize: 11, color: "#3B82F6", marginTop: 2 }}>Tap to open / download</Text>
                            </View>
                            <Feather name="download" size={16} color="#2563EB" />
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
                              style={{ flex: 1, backgroundColor: "#FEF2F2", borderRadius: 10, paddingVertical: 11, alignItems: "center", borderWidth: 1, borderColor: "#FECACA" }}
                            >
                              <Text style={{ fontSize: 13, fontWeight: "700", color: "#DC2626" }}>Reject</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => handleAcceptPrescription(p._id)}
                              disabled={isPrescriptionBusy}
                              style={{ flex: 2, backgroundColor: "#10B981", borderRadius: 10, paddingVertical: 11, alignItems: "center" }}
                            >
                              {isPrescriptionBusy ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                              ) : (
                                <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>✓ Accept Prescription</Text>
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
                    /* ── VIDEO CONSULTATION FLOW ─────────────────────────────── */
                    <>
                      {(request.status === "searching" ||
                        request.status === "pending") && (
                        <View className="flex-row" style={{ gap: 10 }}>
                          <TouchableOpacity
                            onPress={() =>
                              handleDecline(request._id, patientName)
                            }
                            disabled={isBusy}
                            className="flex-1 bg-red-50 rounded-xl py-3 px-4 items-center border border-red-200"
                          >
                            {isLoadingAction("decline") ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Text className="text-red-600 font-bold text-sm">
                                Decline
                              </Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleAccept(request)}
                            disabled={isBusy}
                            className="flex-1 bg-blue-600 rounded-xl py-3 px-4 items-center"
                          >
                            {isLoadingAction("accept") ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text className="text-white font-bold text-sm">
                                Accept
                              </Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {["accepted", "payment_pending"].includes(
                        request.status,
                      ) && (
                        <View
                          className="bg-sky-50 rounded-lg p-3 border border-sky-200 flex-row items-center justify-center"
                          style={{ gap: 8 }}
                        >
                          <ActivityIndicator size="small" color="#0369A1" />
                          <Text className="text-xs text-sky-700 font-semibold">
                            Waiting for patient to confirm payment...
                          </Text>
                        </View>
                      )}

                      {request.status === "provider_confirmation_pending" && (
                        <TouchableOpacity
                          onPress={() =>
                            handlePaymentReceived(request._id, patientName)
                          }
                          disabled={isBusy}
                          className="bg-sky-600 rounded-xl py-3 px-4 items-center"
                        >
                          {isLoadingAction("payment_received") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-white font-bold text-sm">
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
                          className="bg-blue-600 rounded-xl py-3 px-4 items-center flex-row justify-center"
                          style={{ gap: 8 }}
                        >
                          <Feather name="video" size={16} color="#FFFFFF" />
                          <Text className="text-white font-bold text-sm">
                            {request.status === "in_call"
                              ? "Return to Call"
                              : "Join Call"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {request.status === "completed" && (
                        <View
                          className="bg-green-50 rounded-lg p-3 border border-green-200 flex-row items-center justify-center"
                          style={{ gap: 6 }}
                        >
                          <Feather
                            name="check-circle"
                            size={14}
                            color="#16A34A"
                          />
                          <Text className="text-xs text-green-700 font-semibold">
                            Consultation Completed
                          </Text>
                        </View>
                      )}
                    </>
                  ) : isPharmacist ? (
                    /* ── PHARMACIST / PRESCRIPTION DELIVERY FLOW ─────────────── */
                    <>
                      {(request.status === "searching" || request.status === "pending") && (
                        <View className="bg-amber-50 rounded-lg p-3 border border-amber-200">
                          <Text className="text-xs text-amber-700 font-medium text-center">
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
                            className="bg-indigo-600 rounded-xl py-3 px-4 items-center flex-row justify-center"
                            style={{ gap: 8, opacity: (isBusy || !prescriptionAccepted) ? 0.5 : 1 }}
                          >
                            {isLoadingAction("route") ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <>
                                <Feather name="navigation" size={16} color="#FFFFFF" />
                                <Text className="text-white font-bold text-sm">Start Delivery</Text>
                              </>
                            )}
                          </TouchableOpacity>
                        );
                      })()}

                      {request.status === "en_route" && (
                        <TouchableOpacity
                          onPress={() => handleMarkRoute(request)}
                          disabled={isBusy}
                          className="bg-indigo-600 rounded-xl py-3 px-4 items-center flex-row justify-center"
                          style={{ gap: 8, opacity: isBusy ? 0.5 : 1 }}
                        >
                          {isLoadingAction("route") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Feather name="navigation" size={16} color="#FFFFFF" />
                              <Text className="text-white font-bold text-sm">
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
                          className="bg-green-600 rounded-xl py-3 px-4 items-center"
                        >
                          {isLoadingAction("complete") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-white font-bold text-sm">Complete Delivery</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "in_progress" && (
                        <TouchableOpacity
                          onPress={() => confirmCompleteConsultation(request._id, patientName)}
                          disabled={isBusy}
                          className="bg-green-600 rounded-xl py-3 px-4 items-center"
                        >
                          {isLoadingAction("complete") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-white font-bold text-sm">Complete Delivery</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "completed" && (
                        <View className="bg-green-50 rounded-lg p-3 border border-green-200 flex-row items-center justify-center" style={{ gap: 6 }}>
                          <Feather name="check-circle" size={14} color="#16A34A" />
                          <Text className="text-xs text-green-700 font-semibold">Delivery Completed</Text>
                        </View>
                      )}
                    </>
                  ) : (
                    /* ── NORMAL CONSULTATION FLOW ─────────────────────────────── */
                    <>
                      {(request.status === "searching" || request.status === "pending") && (
                        <View className="flex-row" style={{ gap: 10 }}>
                          <TouchableOpacity
                            onPress={() => handleDecline(request._id, patientName)}
                            disabled={isBusy}
                            className="flex-1 bg-red-50 rounded-xl py-3 px-4 items-center border border-red-200"
                          >
                            {isLoadingAction("decline") ? (
                              <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                              <Text className="text-red-600 font-bold text-sm">Decline</Text>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            onPress={() => handleAccept(request)}
                            disabled={isBusy}
                            className="flex-1 bg-blue-600 rounded-xl py-3 px-4 items-center"
                          >
                            {isLoadingAction("accept") ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <Text className="text-white font-bold text-sm">Accept</Text>
                            )}
                          </TouchableOpacity>
                        </View>
                      )}

                      {request.status === "accepted" && (
                        <TouchableOpacity
                          onPress={() => handleMarkRoute(request)}
                          disabled={isBusy}
                          className="bg-indigo-600 rounded-xl py-3 px-4 items-center flex-row justify-center"
                          style={{ gap: 8 }}
                        >
                          {isLoadingAction("route") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Feather name="navigation" size={16} color="#FFFFFF" />
                              <Text className="text-white font-bold text-sm">Navigate to Patient</Text>
                            </>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "en_route" && (
                        <TouchableOpacity
                          onPress={() => handleMarkRoute(request)}
                          disabled={isBusy}
                          className="bg-indigo-600 rounded-xl py-3 px-4 items-center flex-row justify-center"
                          style={{ gap: 8, opacity: isBusy ? 0.5 : 1 }}
                        >
                          {isLoadingAction("route") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <>
                              <Feather name="navigation" size={16} color="#FFFFFF" />
                              <Text className="text-white font-bold text-sm">
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
                          className="bg-blue-600 rounded-xl py-3 px-4 items-center"
                        >
                          {isLoadingAction("start") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-white font-bold text-sm">Start Consultation</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {request.status === "in_progress" && (
                        <TouchableOpacity
                          onPress={() => confirmCompleteConsultation(request._id, patientName)}
                          disabled={isBusy}
                          className="bg-green-600 rounded-xl py-3 px-4 items-center"
                        >
                          {isLoadingAction("complete") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-white font-bold text-sm">Complete Consultation</Text>
                          )}
                        </TouchableOpacity>
                      )}

                      {/* payment_pending = waiting for patient to pay */}
                      {request.status === "payment_pending" && (
                        <View className="bg-sky-50 rounded-lg p-3 border border-sky-200 flex-row items-center justify-center" style={{ gap: 8 }}>
                          <ActivityIndicator size="small" color="#0369A1" />
                          <Text className="text-xs text-sky-700 font-semibold">Waiting for patient to confirm payment…</Text>
                        </View>
                      )}

                      {/* provider_confirmation_pending = patient paid, provider must confirm receipt */}
                      {request.status === "provider_confirmation_pending" && (
                        <TouchableOpacity
                          onPress={() => handlePaymentReceived(request._id, patientName)}
                          disabled={isBusy}
                          className="bg-sky-600 rounded-xl py-3 px-4 items-center"
                        >
                          {isLoadingAction("payment_received") ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <Text className="text-white font-bold text-sm">Confirm Payment Received</Text>
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
                          className="bg-blue-600 rounded-xl py-3 px-4 items-center flex-row justify-center"
                          style={{ gap: 8 }}
                        >
                          <Feather name="video" size={16} color="#FFFFFF" />
                          <Text className="text-white font-bold text-sm">
                            {request.status === "in_call"
                              ? "Return to Call"
                              : "Join Call"}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {request.status === "completed" && (
                        <View className="bg-green-50 rounded-lg p-3 border border-green-200 flex-row items-center justify-center" style={{ gap: 6 }}>
                          <Feather name="check-circle" size={14} color="#16A34A" />
                          <Text className="text-xs text-green-700 font-semibold">Consultation Completed</Text>
                        </View>
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
            })
          )}
        </View>
      </ScrollView>

      {/* Full-screen image viewer */}
      <Modal
        visible={!!imageViewerUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerUrl(null)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}
          onPress={() => setImageViewerUrl(null)}
          activeOpacity={1}
        >
          {/* Close button */}
          <View style={{ position: "absolute", top: 52, right: 20, zIndex: 10, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 999, padding: 10 }}>
            <Feather name="x" size={24} color="#FFFFFF" />
          </View>
          {imageViewerUrl && (
            <Image
              source={{ uri: imageViewerUrl }}
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

    </AppScreenShell>
  );
}

const requestCardStyles = StyleSheet.create({
  card: {
    overflow: "hidden",
    position: "relative",
    paddingLeft: 18,
  },
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
  },
  headerMain: {
    flex: 1,
    minWidth: 0,
  },
  patientName: {
    fontSize: 16,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  phoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
    alignSelf: "flex-start",
  },
  phoneText: {
    fontSize: 13,
    fontWeight: "600",
    color: AUTH_COLORS.greenDark,
  },
  ailmentLine: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
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
    fontSize: 10,
    fontWeight: "700",
  },
  detailsPanel: {
    backgroundColor: AUTH_COLORS.bg,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 14,
    marginBottom: 14,
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
    backgroundColor: AUTH_COLORS.inputBorder,
    marginHorizontal: 12,
  },
  detailLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 15,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  detailsSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: AUTH_COLORS.inputBorder,
    marginVertical: 12,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  modeIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  modeLabel: {
    fontSize: 13,
    fontWeight: "700",
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
});

