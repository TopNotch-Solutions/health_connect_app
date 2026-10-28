import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { ensureForegroundLocationPermission } from "../../../../lib/locationPermission";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  AppEmptyState,
  AppHeroCard,
  AppScreenShell,
  appScreenStyles,
  getFirstName,
  getGreeting,
  getGreetingEmoji,
  AUTH_COLORS,
} from "../../../../components/app/AppScreenUI";
import PatientProviderTracking from "../../../../components/(patient)/PatientProviderTracking";
import PrescriptionUploadModal, {
  PrescriptionData,
} from "../../../../components/(patient)/PrescriptionUploadModal";
import PatientProviderPrescriptionView from "../../../../components/(patient)/PatientProviderPrescriptionView";
import ProviderMap from "../../../../components/(patient)/ProviderMap";
import { useAuth } from "../../../../context/AuthContext";
import { alertConsultationStatusChange } from "../../../../lib/consultationAlert";
import { canShowProviderPhone } from "../../../../lib/providerContactVisibility";
import socketService from "../../../../lib/socket";
import apiClient from "../../../../lib/api";
import { getUserFacingErrorMessage } from "../../../../lib/userFacingError";
import { showAlertDialog } from "@/components/AlertDialog";

interface RequestStatus {
  _id: string;
  consultationMode?: "house_visit" | "video_consultation";
  paymentMethod?: "wallet" | "cash" | "medical_aid";
  // Provider type (e.g. "Pharmacist") ? from populated ailmentCategoryId
  providerType?: string;
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
  createdAt: string;
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
    profileImage?: string;
    bio?: string;
  };
  patientId?: {
    _id: string;
    fullname: string;
    walletID: string;
    profileImage?: string;
  };
  providerResponse?: {
    responseTime: string;
    estimatedArrival: string;
  };
  timeline?: {
    requested: string;
    providerAccepted: string;
    providerEnRoute: string;
    providerArrived: string;
    consultationStarted: string;
    consultationCompleted: string;
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

const normalizeProviderLabel = (value?: string | null) => {
  if (!value) return "";
  return String(value).trim().toLowerCase();
};

const isPharmacyProvider = (value?: string | null) =>
  normalizeProviderLabel(value) === "pharmacist";

interface StoredRequest {
  request: RequestStatus;
  acceptedAt: number; // Timestamp when request was accepted
}

/** Strip PII before writing waiting-room snapshots to AsyncStorage. */
const sanitizeRequestsForCache = (items: StoredRequest[]): StoredRequest[] =>
  items.map((item) => {
    const request: any = { ...item.request };
    if (request.medicalAidDetails) {
      const { medicalAidTitle, icd10Code, maf } = request.medicalAidDetails;
      request.medicalAidDetails = {
        ...(medicalAidTitle ? { medicalAidTitle } : {}),
        ...(icd10Code ? { icd10Code } : {}),
        ...(maf ? { maf } : {}),
      };
    }
    if (request.providerId && typeof request.providerId === "object") {
      const { _id, fullname, role, profileImage, walletID } = request.providerId;
      request.providerId = { _id, fullname, role, profileImage, walletID };
    }
    if (request.patientId && typeof request.patientId === "object") {
      const { _id, fullname, walletID, profileImage } = request.patientId;
      request.patientId = { _id, fullname, walletID, profileImage };
    }
    return { ...item, request };
  });

const StatusBadge = ({ status }: { status: string }) => {
  const meta = (() => {
    switch (status) {
      case "searching":
      case "pending":
        return {
          icon: "clock" as const,
          color: AUTH_COLORS.textMuted,
          bg: "#F3F4F6",
        };
      case "accepted":
      case "paid":
      case "ready_for_call":
      case "arrived":
      case "completed":
        return {
          icon: "check" as const,
          color: AUTH_COLORS.greenDark,
          bg: AUTH_COLORS.greenSoft,
        };
      case "payment_pending":
      case "provider_confirmation_pending":
        return {
          icon: "credit-card" as const,
          color: AUTH_COLORS.greenDark,
          bg: "#F0FDF4",
        };
      case "in_call":
      case "in_progress":
        return {
          icon: "activity" as const,
          color: AUTH_COLORS.greenDark,
          bg: AUTH_COLORS.greenSoft,
        };
      case "en_route":
        return {
          icon: "navigation" as const,
          color: AUTH_COLORS.greenDark,
          bg: "#F0FDF4",
        };
      case "cancelled":
      case "expired":
      case "rejected":
        return {
          icon: "x-circle" as const,
          color: AUTH_COLORS.error,
          bg: "#FEF2F2",
        };
      default:
        return {
          icon: "help-circle" as const,
          color: AUTH_COLORS.textMuted,
          bg: "#F3F4F6",
        };
    }
  })();

  return (
    <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
      <Feather name={meta.icon} size={12} color={meta.color} />
      <Text style={[styles.statusBadgeText, { color: meta.color }]}>
        {status.replace(/_/g, " ")}
      </Text>
    </View>
  );
};

const RequestCard = ({
  item,
  onCancel,
  onConfirmPayment,
  patientLocation,
  patientProfileImage,
  prescriptions,
  onPrescriptionUploaded,
}: {
  item: StoredRequest;
  onCancel?: (requestId: string) => void;
  onConfirmPayment?: (requestId: string) => Promise<void>;
  patientLocation?: { latitude: number; longitude: number } | null;
  patientProfileImage?: string;
  prescriptions: Record<string, PrescriptionData>;
  onPrescriptionUploaded: (requestId: string, prescription: PrescriptionData) => void;
}) => {
  const request = item.request;
  const acceptedAt = item.acceptedAt;
  const expiresAt = acceptedAt + 24 * 60 * 60 * 1000; // 24 hours
  const timeRemaining = expiresAt - Date.now();
  const hoursRemaining = Math.floor(timeRemaining / (60 * 60 * 1000));
  const minutesRemaining = Math.floor(
    (timeRemaining % (60 * 60 * 1000)) / (60 * 1000),
  );
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [trackingModalVisible, setTrackingModalVisible] = useState(false);
  const [prescriptionModalVisible, setPrescriptionModalVisible] = useState(false);
  const router = useRouter();

  // Is this a pharmacy request?
  const isPharmacyRequest =
    (typeof request.ailmentCategoryId === "object" &&
      isPharmacyProvider((request.ailmentCategoryId as any)?.provider)) ||
    isPharmacyProvider(request.providerType);

  // Show prescription upload when the ailment has requiresPrescription: true
  // OR when the ailment title contains "prescription" (covers the seeded
  // "Prescription Delivery" category that predates the requiresPrescription flag)
  const requiresPrescription =
    typeof request.ailmentCategoryId === "object" &&
    (
      !!(request.ailmentCategoryId as any)?.requiresPrescription ||
      /prescription/i.test((request.ailmentCategoryId as any)?.title ?? "")
    );

  const showPrescriptionSection = isPharmacyRequest && requiresPrescription;

  const prescription = prescriptions[request._id] ?? null;

  const consultationModeMeta =
    request.consultationMode === "video_consultation"
      ? { label: "Video", icon: "video" as const }
      : { label: "House visit", icon: "home" as const };

  // Debug logging for profile images
  useEffect(() => {
    if (trackingModalVisible) {
    }
  }, [trackingModalVisible, request.providerId, patientProfileImage]);

  const handleCancel = async () => {
    showAlertDialog(
      "Cancel Request",
      "Are you sure you want to cancel this healthcare request?",
      [
        {
          text: "No",
          onPress: () => {},
          style: "cancel",
        },
        {
          text: "Yes, Cancel",
          onPress: async () => {
            try {
              setIsCancelling(true);
              await socketService.cancelRequest(
                request._id,
                "patient",
                "Patient cancelled the request",
              );
              // Remove from UI immediately
              onCancel?.(request._id);
              Alert.alert("Cancelled", "Your request has been cancelled");
            } catch (error: any) {
              Alert.alert(
                "Error",
                getUserFacingErrorMessage(error, "Failed to cancel request"),
              );
              setIsCancelling(false);
            }
          },
          style: "destructive",
        },
      ],
    );
  };

  const handleConfirmPayment = async () => {
    if (!onConfirmPayment) return;

    showAlertDialog(
      "Payment Confirmed",
      "Only continue after you have sent the money to the provider through eWallet or the agreed transfer method.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Payment Confirmed",
          onPress: async () => {
            try {
              setIsPaying(true);
              await onConfirmPayment(request._id);
              Alert.alert(
                "Payment Marked As Sent",
                "Your provider will confirm receipt before the video call starts.",
              );
            } catch (error: any) {
              Alert.alert(
                "Payment Error",
                getUserFacingErrorMessage(error, "Failed to confirm payment."),
              );
            } finally {
              setIsPaying(false);
            }
          },
        },
      ],
    );
  };

  const getStatusDescription = (status: string) => {
    switch (status) {
      case "searching":
        return "Searching for available providers...";
      case "pending":
        return "Request sent to provider, waiting for response...";
      case "accepted":
        return `Provider ${request.providerId?.fullname || "has"} accepted your request`;
      case "payment_pending":
        return request.paymentMethod === "cash"
          ? `Provider ${request.providerId?.fullname || "has"} accepted your teleconsultation. Pay through eWallet, then tap Payment Confirmed.`
          : `Provider ${request.providerId?.fullname || "has"} accepted your teleconsultation.`;
      case "paid":
        return "Payment has been marked as received.";
      case "provider_confirmation_pending":
        return "Waiting for your provider to confirm they received your payment.";
      case "ready_for_call":
        return request.paymentMethod === "medical_aid"
          ? "Your medical aid teleconsultation is ready to begin."
          : "Your teleconsultation is ready to begin.";
      case "in_call":
        return "Video consultation is in progress.";
      case "en_route":
        return `Provider is on the way (${request.providerResponse?.estimatedArrival || "ETA pending"})`;
      case "arrived":
        return "Provider has arrived at your location";
      case "in_progress":
        return "Consultation is in progress...";
      case "completed":
        return "Consultation has been completed";
      case "cancelled":
        return "Request was cancelled";
      case "expired":
        return "Request expired ? please create a new request if you still need care";
      case "rejected":
        return "Request was rejected";
      default:
        return status;
    }
  };

  return (
    <View style={styles.requestCard}>
      <View style={styles.requestHeaderRow}>
        <View style={styles.requestHeaderText}>
          <Text style={styles.requestTitle}>
            {request.ailmentCategoryId?.title || "Healthcare request"}
          </Text>
          <Text style={styles.requestDescription}>
            {getStatusDescription(request.status)}
          </Text>
        </View>
        <StatusBadge status={request.status} />
      </View>

      <View style={styles.modeRow}>
        <Feather
          name={consultationModeMeta.icon}
          size={13}
          color={AUTH_COLORS.greenDark}
        />
        <Text style={styles.modeText}>{consultationModeMeta.label}</Text>
      </View>

      {[
        "accepted",
        "payment_pending",
        "paid",
        "provider_confirmation_pending",
        "ready_for_call",
        "in_call",
        "en_route",
        "arrived",
      ].includes(request.status) &&
        request.providerId && (
        <View style={styles.providerCard}>
          <Text style={styles.providerCardLabel}>Provider</Text>
          <View style={styles.providerHeaderRow}>
            <View style={styles.providerAvatar}>
              <Feather name="user" size={14} color={AUTH_COLORS.greenDark} />
            </View>
            <View style={styles.providerIdentity}>
              <Text style={styles.providerName}>
                {request.providerId.fullname}
              </Text>
              <Text style={styles.providerRoleText}>
                {request.providerId.role}
              </Text>
            </View>
          </View>
          {canShowProviderPhone(request.status) &&
          request.providerId.cellphoneNumber ? (
            <TouchableOpacity
              style={styles.providerPhoneRow}
              onPress={() => {
                const phone = request.providerId?.cellphoneNumber;
                if (phone) Linking.openURL(`tel:${phone}`);
              }}
              activeOpacity={0.7}
            >
              <Feather name="phone" size={14} color={AUTH_COLORS.green} />
              <Text style={styles.providerPhone}>
                {request.providerId.cellphoneNumber}
              </Text>
              <Feather
                name="chevron-right"
                size={16}
                color={AUTH_COLORS.textMuted}
              />
            </TouchableOpacity>
          ) : null}
          {request.providerId.bio ? (
            <Text style={styles.providerBio}>{request.providerId.bio}</Text>
          ) : null}
        </View>
      )}

      {request.consultationMode === "video_consultation" &&
        request.paymentMethod === "cash" &&
        ["payment_pending", "provider_confirmation_pending"].includes(
          request.status,
        ) &&
        request.providerId && (
          <View style={styles.paymentInstructionCard}>
            <Text style={styles.paymentInstructionTitle}>Payment</Text>
            <Text style={styles.paymentInstructionText}>
              Pay via eWallet to the number below, then tap{" "}
              <Text style={styles.paymentInstructionStrong}>
                Payment Confirmed
              </Text>
              .
            </Text>
            {canShowProviderPhone(request.status) &&
            request.providerId.cellphoneNumber ? (
              <Text style={styles.paymentInstructionPhone}>
                {request.providerId.cellphoneNumber}
              </Text>
            ) : null}
          </View>
        )}

      {request.providerResponse?.estimatedArrival &&
        request.status !== "in_progress" &&
        request.status !== "completed" && (
          <View style={styles.etaRow}>
            <Feather name="navigation" size={14} color={AUTH_COLORS.green} />
            <Text style={styles.etaText}>
              ETA {request.providerResponse.estimatedArrival}
            </Text>
          </View>
        )}

      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Feather name="map-pin" size={14} color={AUTH_COLORS.textMuted} />
          <Text style={styles.metaText} numberOfLines={2}>
            {request.address?.route}, {request.address?.locality}
          </Text>
        </View>
        <View style={styles.metaRow}>
          <Feather name="calendar" size={14} color={AUTH_COLORS.textMuted} />
          <Text style={styles.metaText}>
            Requested {new Date(request.createdAt).toLocaleString()}
          </Text>
        </View>
        {request.timeline?.consultationStarted ? (
          <View style={styles.metaRow}>
            <Feather
              name="play-circle"
              size={14}
              color={AUTH_COLORS.textMuted}
            />
            <Text style={styles.metaText}>
              Started{" "}
              {new Date(request.timeline.consultationStarted).toLocaleString()}
            </Text>
          </View>
        ) : null}
        {request.timeline?.consultationCompleted ? (
          <View style={styles.metaRow}>
            <Feather
              name="check-circle"
              size={14}
              color={AUTH_COLORS.textMuted}
            />
            <Text style={styles.metaText}>
              Completed{" "}
              {new Date(
                request.timeline.consultationCompleted,
              ).toLocaleString()}
            </Text>
          </View>
        ) : null}
      </View>

      {["accepted", "payment_pending"].includes(request.status) &&
        timeRemaining > 0 && (
        <Text style={styles.expiryText}>
          Expires in{" "}
          <Text style={styles.expiryStrong}>
            {hoursRemaining}h {minutesRemaining}m
          </Text>
        </Text>
      )}

      {/* Track Provider button - show if en_route or arrived */}
      {["en_route", "arrived"].includes(request.status) &&
        request.providerId && (
          <>
            <TouchableOpacity
              onPress={() => setTrackingModalVisible(true)}
              style={styles.actionSecondary}
              activeOpacity={0.85}
            >
              <View style={styles.actionIconSoft}>
                <Feather name="map" size={16} color={AUTH_COLORS.greenDark} />
              </View>
              <Text style={styles.actionSecondaryText}>
                Track provider
              </Text>
              <Feather name="chevron-right" size={18} color={AUTH_COLORS.green} />
            </TouchableOpacity>

            <PatientProviderTracking
              visible={trackingModalVisible}
              onClose={() => setTrackingModalVisible(false)}
              requestId={request._id}
              patientLocation={patientLocation || request.address?.coordinates}
              providerName={request.providerId.fullname}
              providerRole={request.providerId.role}
              providerProfileImage={request.providerId.profileImage}
              patientProfileImage={patientProfileImage}
            />
          </>
        )}

      {request.consultationMode === "video_consultation" &&
        request.paymentMethod === "cash" &&
        request.status === "payment_pending" && (
          <TouchableOpacity
            onPress={handleConfirmPayment}
            disabled={isPaying}
            style={[
              styles.actionPrimary,
              isPaying ? styles.actionDisabled : null,
            ]}
            activeOpacity={0.88}
          >
            {isPaying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <View style={styles.actionIconOnPrimary}>
                  <Feather name="credit-card" size={16} color="#FFFFFF" />
                </View>
                <Text style={styles.actionPrimaryText}>
                  Payment confirmed
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

      {request.consultationMode === "video_consultation" &&
        ["ready_for_call", "in_call"].includes(request.status) && (
          <TouchableOpacity
            onPress={() =>
              router.push(
                `/(app)/(patient)/teleconsultation-call?requestId=${encodeURIComponent(request._id)}` as Href,
              )
            }
            style={styles.actionPrimary}
            activeOpacity={0.88}
          >
            <View style={styles.actionIconOnPrimary}>
              <Feather name="video" size={16} color="#FFFFFF" />
            </View>
            <Text style={styles.actionPrimaryText}>
              {request.status === "in_call" ? "Return to call" : "Join video call"}
            </Text>
          </TouchableOpacity>
        )}

      {showPrescriptionSection && (
        <View style={styles.prescriptionSection}>
          {prescription ? (
            <View style={styles.prescriptionStatusRow}>
              <Feather
                name={
                  prescription.status === "accepted"
                    ? "check"
                    : prescription.status === "rejected"
                      ? "alert-triangle"
                      : "clock"
                }
                size={14}
                color={
                  prescription.status === "accepted"
                    ? AUTH_COLORS.green
                    : AUTH_COLORS.textMuted
                }
              />
              <Text style={styles.prescriptionStatusText}>
                {prescription.status === "accepted"
                  ? "Prescription accepted ? delivery in progress"
                  : prescription.status === "rejected"
                    ? "Prescription rejected ? please re-upload"
                    : "Prescription awaiting pharmacist review"}
              </Text>
            </View>
          ) : (
            <View style={styles.prescriptionStatusRow}>
              <Feather name="upload" size={14} color={AUTH_COLORS.textMuted} />
              <Text style={styles.prescriptionStatusText}>
                Prescription required ? please upload
              </Text>
            </View>
          )}

          {prescription?.status !== "accepted" && (
            <TouchableOpacity
              style={styles.actionPrimary}
              onPress={() => setPrescriptionModalVisible(true)}
              activeOpacity={0.88}
            >
              <View style={styles.actionIconOnPrimary}>
                <Feather
                  name={prescription?.prescriptionImage ? "edit-2" : "upload"}
                  size={15}
                  color="#FFFFFF"
                />
              </View>
              <Text style={styles.actionPrimaryText}>
                {prescription?.prescriptionImage
                  ? "Edit prescription"
                  : "Upload prescription"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {isPharmacyRequest && (
        <PrescriptionUploadModal
          visible={prescriptionModalVisible}
          onClose={() => setPrescriptionModalVisible(false)}
          requestId={request._id}
          prescription={prescription}
          onUploaded={(p) => {
            onPrescriptionUploaded(request._id, p);
            setPrescriptionModalVisible(false);
          }}
        />
      )}

      {/* Provider-issued clinical prescription (doctor / prescribing nurse) */}
      <PatientProviderPrescriptionView
        requestId={request._id}
        requestStatus={request.status}
        enabled={!isPharmacyRequest}
      />

      {/* Cancel button for active requests */}
      {[
        "searching",
        "pending",
        "accepted",
        "payment_pending",
        "paid",
        "provider_confirmation_pending",
        "ready_for_call",
        "en_route",
      ].includes(
        request.status,
      ) && (
        <TouchableOpacity
          onPress={handleCancel}
          disabled={isCancelling}
          style={[
            styles.actionDanger,
            isCancelling ? styles.actionDisabled : null,
          ]}
          activeOpacity={0.85}
        >
          {isCancelling ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <View style={styles.actionIconDanger}>
                <Feather name="x" size={16} color="#DC2626" />
              </View>
              <Text style={styles.actionDangerText}>Cancel request</Text>
            </>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
};

export default function WaitingRoom() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<StoredRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [patientLocation, setPatientLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  // Track provider locations keyed by requestId
  const [providerLocations, setProviderLocations] = useState<
    Record<string, { latitude: number; longitude: number }>
  >({});
  // Prescriptions keyed by requestId
  const [prescriptions, setPrescriptions] = useState<Record<string, PrescriptionData>>({});

  const handleRequestCancelled = useCallback((requestId: string) => {
    setRequests((prev) =>
      prev.filter((item) => item.request._id !== requestId),
    );
  }, []);

  const handlePrescriptionUploaded = useCallback(
    (requestId: string, prescription: PrescriptionData) => {
      setPrescriptions((prev) => ({ ...prev, [requestId]: prescription }));
    },
    [],
  );

  // Fetch prescriptions for pharmacy-type requests
  const loadPrescriptions = useCallback(
    async (activeRequests: StoredRequest[]) => {
      const pharmacyRequests = activeRequests.filter((item) => {
        const cat = item.request.ailmentCategoryId;
        return (
          (typeof cat === "object" &&
            isPharmacyProvider((cat as any)?.provider)) ||
          isPharmacyProvider(item.request.providerType)
        );
      });
      if (!pharmacyRequests.length) return;

      const results: Record<string, PrescriptionData> = {};
      await Promise.all(
        pharmacyRequests.map(async (item) => {
          try {
            const res = await apiClient.get(
              `/app/prescription/by-request/${item.request._id}`,
            );
            if (res.data.prescription) {
              results[item.request._id] = res.data.prescription;
            }
          } catch {
            // 404 = no prescription yet ? that's fine
          }
        }),
      );
      if (Object.keys(results).length) {
        setPrescriptions((prev) => ({ ...prev, ...results }));
      }
    },
    [],
  );

  // Keep a ref to the current requests list so the polling interval
  // can call loadPrescriptions without closing over a stale value.
  const requestsRef = useRef<StoredRequest[]>([]);
  useEffect(() => {
    requestsRef.current = requests;
  }, [requests]);

  // Poll every 8 seconds while any pharmacy prescription is still pending_review.
  // This ensures the patient sees the acceptance/rejection immediately without
  // having to navigate away and back.
  const prescriptionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const hasPendingPrescription = Object.values(prescriptions).some(
      (p) => p.status === "pending_review",
    );

    if (hasPendingPrescription) {
      if (!prescriptionPollRef.current) {
        prescriptionPollRef.current = setInterval(() => {
          loadPrescriptions(requestsRef.current);
        }, 8000);
      }
    } else {
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
  }, [prescriptions, loadPrescriptions]);

  const handleConfirmPayment = useCallback(
    async (requestId: string) => {
      if (!user?.userId) {
        throw new Error("User session not available.");
      }

      await socketService.confirmTeleconsultationPayment(
        requestId,
        user.userId,
      );

      setRequests((prev) =>
        prev.map((item) =>
          item.request._id === requestId
            ? {
                ...item,
                request: {
                  ...item.request,
                  status: "provider_confirmation_pending",
                },
              }
            : item,
        ),
      );
    },
    [user?.userId],
  );

  // Use location only if permission was already granted (no prompt on screen open)
  useEffect(() => {
    const defaultLocation = { latitude: -26.2041, longitude: 28.0473 };

    (async () => {
      try {
        const { granted } = await ensureForegroundLocationPermission({
          requestIfNeeded: false,
        });
        if (!granted) {
          setPatientLocation(defaultLocation);
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setPatientLocation({
          latitude: currentLocation.coords.latitude,
          longitude: currentLocation.coords.longitude,
        });
      } catch (error) {
        console.error("Error getting location:", error);
        setPatientLocation(defaultLocation);
      }
    })();
  }, []);

  // Fetch requests from socket and load stored requests
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
            // Create a set of live request IDs for filtering
            const liveRequestIds = new Set(
              liveRequests.map((req: RequestStatus) => req._id),
            );

            // Filter stored requests to only keep those that exist in live data
            storedRequests = storedRequests.filter((item) =>
              liveRequestIds.has(item.request._id),
            );

            // Merge live requests with stored ones, prioritizing live data
            const mergedRequests = new Map<string, StoredRequest>();

            // Add stored requests first
            storedRequests.forEach((item) => {
              mergedRequests.set(item.request._id, item);
            });

            const now = Date.now();

            // Override with live requests
            liveRequests.forEach((req: RequestStatus) => {
              const stored = mergedRequests.get(req._id);
              if (
                stored &&
                ["accepted", "payment_pending"].includes(stored.request.status) &&
                !["accepted", "payment_pending"].includes(req.status)
              ) {
                // Keep the original acceptedAt timestamp
                mergedRequests.set(req._id, {
                  request: req,
                  acceptedAt: stored.acceptedAt,
                });
              } else {
                // For newly accepted requests, record the time
                const acceptedAt =
                  ["accepted", "payment_pending"].includes(req.status) && !stored
                    ? now
                    : stored?.acceptedAt || now;
                mergedRequests.set(req._id, { request: req, acceptedAt });
              }
            });

            const merged = Array.from(mergedRequests.values());
            setRequests(merged);

            // Load prescriptions for any pharmacy-type requests
            loadPrescriptions(merged);

            // For any already-accepted requests, try to fetch initial provider location
            merged.forEach((item) => {
              try {
                if (
                  ["accepted", "payment_pending"].includes(item.request.status) &&
                  item.request._id
                ) {
                  socketService
                    .getSocket()
                    ?.emit(
                      "getProviderLocation",
                      { requestId: item.request._id },
                      (location: any) => {
                        if (
                          location &&
                          location.latitude &&
                          location.longitude
                        ) {
                          setProviderLocations((prev) => ({
                            ...prev,
                            [item.request._id]: location,
                          }));
                        }
                      },
                    );
                }
              } catch (e) {
                console.warn(
                  "Could not fetch provider location for stored accepted request",
                  e,
                );
              }
            });

            // Save updated requests to storage (now only valid ones)
            await AsyncStorage.setItem(
              `waiting-room-${user?.userId}`,
              JSON.stringify(sanitizeRequestsForCache(merged)),
            );
          } else {
            setRequests(storedRequests);
          }
        } catch {
          setRequests(storedRequests);
        }
      } else {
        // If not connected, still validate stored requests against last known state
        const now = Date.now();
        storedRequests = storedRequests.filter((item) => {
          if (["accepted", "payment_pending"].includes(item.request.status)) {
            const expiresAt = item.acceptedAt + 24 * 60 * 60 * 1000;
            return now < expiresAt;
          }
          // For non-accepted requests, only keep recent ones (within 3 hours)
          const age = now - new Date(item.request.createdAt).getTime();
          return age < 3 * 60 * 60 * 1000;
        });
        setRequests(storedRequests);
      }
    } catch (error) {
      console.error("Error loading requests:", error);
      setRequests([]);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user?.userId, loadPrescriptions]);

  useEffect(() => {
    if (!user?.userId) return;

    const socket = socketService.connect(user.userId, "patient");

    if (socket.connected) {
      socketService.join(user.userId, "patient");
    }

    const handleConnect = () => {
      socketService.join(user.userId, "patient");
      loadRequests();
    };

    socket.on("connect", handleConnect);

    return () => {
      socket.off("connect", handleConnect);
    };
  }, [loadRequests, user?.userId]);

  // Initial load on mount
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // Refresh when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests]),
  );

  // Set up socket listeners
  useEffect(() => {
    if (!user?.userId) return;

    const handleRequestUpdated = async (updatedRequest: RequestStatus) => {
      // Ring + vibrate OUTSIDE setState ? updater functions can be re-run by React
      const existing = requestsRef.current.find(
        (item) => item.request._id === updatedRequest._id,
      );
      if (existing && existing.request.status !== updatedRequest.status) {
        void alertConsultationStatusChange(
          updatedRequest.status,
          updatedRequest._id,
          "patient",
        );
      }

      setRequests((prev) => {
        const updated = prev.map((item) => {
          if (item.request._id === updatedRequest._id) {
            // Preserve acceptedAt timestamp if transitioning to accepted
            const acceptedAt =
              ["accepted", "payment_pending"].includes(updatedRequest.status) &&
              !["accepted", "payment_pending"].includes(item.request.status)
                ? Date.now()
                : item.acceptedAt;
            return { request: updatedRequest, acceptedAt };
          }
          return item;
        });

        // If request not in list but is in active state, add it
        if (
          !updated.find((r) => r.request._id === updatedRequest._id) &&
          [
            "searching",
            "pending",
            "accepted",
            "payment_pending",
            "paid",
            "provider_confirmation_pending",
            "ready_for_call",
            "in_call",
            "en_route",
            "arrived",
            "in_progress",
          ].includes(updatedRequest.status)
        ) {
          updated.push({
            request: updatedRequest,
            acceptedAt:
              ["accepted", "payment_pending"].includes(updatedRequest.status)
                ? Date.now()
                : Date.now(),
          });
        }

        // Save to storage (PII stripped)
        AsyncStorage.setItem(
          `waiting-room-${user.userId}`,
          JSON.stringify(sanitizeRequestsForCache(updated)),
        ).catch((e) => console.error("Failed to save requests:", e));

        // If this request just moved to accepted, try fetching provider's last known location
        try {
          if (
            ["accepted", "payment_pending"].includes(updatedRequest.status) &&
            updatedRequest._id
          ) {
            socketService
              .getSocket()
              ?.emit(
                "getProviderLocation",
                { requestId: updatedRequest._id },
                (location: any) => {
                  if (location && location.latitude && location.longitude) {
                    setProviderLocations((prev) => ({
                      ...prev,
                      [updatedRequest._id]: location,
                    }));
                  }
                },
              );
          }
        } catch (e) {
          console.warn("Could not fetch provider location on accept:", e);
        }

        return updated;
      });
    };

    const handleNewRequestAvailable = async (newRequest: RequestStatus) => {
      setRequests((prev) => {
        if (prev.find((r) => r.request._id === newRequest._id)) {
          return prev;
        }
        return [{ request: newRequest, acceptedAt: Date.now() }, ...prev];
      });
    };

    const handleRequestStatusChanged = (data: {
      requestId: string;
      status: any;
    }) => {

      // Ring + vibrate OUTSIDE setState ? updater functions can be re-run by React
      const existing = requestsRef.current.find(
        (item) => item.request._id === data.requestId,
      );
      if (existing && existing.request.status !== data.status) {
        void alertConsultationStatusChange(
          data.status,
          data.requestId,
          "patient",
        );
      }

      setRequests((prev) => {
        return prev.map((item) => {
          if (item.request._id === data.requestId) {
            // Update status locally
            const updatedRequest = { ...item.request, status: data.status };

            // If accepted, update timestamp
            const acceptedAt =
              ["accepted", "payment_pending"].includes(data.status) &&
              !["accepted", "payment_pending"].includes(item.request.status)
                ? Date.now()
                : item.acceptedAt;

            return { request: updatedRequest, acceptedAt };
          }
          return item;
        });
      });

      // If status changed to something that might have new data (like accepted -> provider assigned),
      // we should probably reload the full request to get provider details if we don't have them.
      if (
        [
          "accepted",
          "payment_pending",
          "paid",
          "provider_confirmation_pending",
          "ready_for_call",
          "in_call",
          "en_route",
          "arrived",
          "in_progress",
          "completed",
          "cancelled",
          "expired",
          "rejected",
        ].includes(data.status)
      ) {
        loadRequests();
      }
    };

    // Set up listeners
    socketService.onRequestUpdated(handleRequestUpdated);
    socketService.onNewRequestAvailable(handleNewRequestAvailable);
    socketService.onRequestStatusChanged(handleRequestStatusChanged);

    // Listen for provider location realtime updates and store by requestId
    const handleProviderLocationUpdate = (data: any) => {
      try {
        if (
          data?.requestId &&
          data.location &&
          data.location.latitude &&
          data.location.longitude
        ) {
          setProviderLocations((prev) => ({
            ...prev,
            [data.requestId]: data.location,
          }));
        }
      } catch (e) {
        console.warn("Error handling provider location update", e);
      }
    };

    socketService
      .getSocket()
      ?.on("updateProviderLocation", handleProviderLocationUpdate);

    return () => {
      socketService.off("requestUpdated", handleRequestUpdated);
      socketService.off("newRequestAvailable", handleNewRequestAvailable);
      socketService.off("requestStatusChanged", handleRequestStatusChanged);
      socketService
        .getSocket()
        ?.off("updateProviderLocation", handleProviderLocationUpdate);
    };
  }, [user?.userId]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadRequests();
  }, [loadRequests]);

  // Sort requests: active/current ones first, then past ones
  const sortedRequests = [...requests]
    .filter(
      (item) =>
        !["completed", "cancelled", "expired", "rejected"].includes(
          item.request.status,
        ),
    )
    .sort((a, b) => {
      const activeStatuses = [
        "searching",
        "pending",
        "accepted",
        "payment_pending",
        "paid",
        "provider_confirmation_pending",
        "ready_for_call",
        "in_call",
        "en_route",
        "arrived",
        "in_progress",
      ];
      const aIsActive = activeStatuses.includes(a.request.status);
      const bIsActive = activeStatuses.includes(b.request.status);

      // Active requests come first
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      // Within same category, sort by creation date (newest first)
      return (
        new Date(b.request.createdAt).getTime() -
        new Date(a.request.createdAt).getTime()
      );
    });

  // Determine first active request (if any) for mapping/visual tracking
  const activeRequest = requests.find((item) =>
    ["accepted", "en_route", "arrived", "in_progress"].includes(
      item.request.status,
    ),
  );

  const showProviderMap = !!patientLocation && !!activeRequest;

  const providersForMap =
    activeRequest && activeRequest.request.providerId
      ? [
          {
            _id:
              activeRequest.request.providerId._id ||
              `provider-${activeRequest.request._id}`,
            firstname: activeRequest.request.providerId.fullname,
            location: providerLocations[activeRequest.request._id],
          },
        ]
      : [];

  if (isLoading) {
    return (
      <AppScreenShell>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={AUTH_COLORS.green} />
          <Text style={styles.loadingText}>Loading your requests?</Text>
        </View>
      </AppScreenShell>
    );
  }

  const firstName = getFirstName(user?.fullname);

  return (
    <AppScreenShell>
      <FlatList
        data={sortedRequests}
        keyExtractor={(item) => item.request._id}
        renderItem={({ item }) => (
          <RequestCard
            item={item}
            onCancel={handleRequestCancelled}
            onConfirmPayment={handleConfirmPayment}
            patientLocation={patientLocation}
            patientProfileImage={user?.profileImage}
            prescriptions={prescriptions}
            onPrescriptionUploaded={handlePrescriptionUploaded}
          />
        )}
        contentContainerStyle={[appScreenStyles.scrollContent, styles.listContent]}
        ListHeaderComponent={
          <>
            <AppHeroCard
              eyebrow={`${getGreeting()} ${getGreetingEmoji()}`}
              name={firstName}
              tagline="Your open requests and provider updates"
              stats={[
                { icon: "inbox", label: `${sortedRequests.length} active` },
              ]}
              style={styles.heroFlush}
            />
            {showProviderMap && patientLocation ? (
              <View style={{ height: 220, width: "100%", marginBottom: 16 }}>
                <ProviderMap
                  userLatitude={patientLocation.latitude}
                  userLongitude={patientLocation.longitude}
                  destinationLatitude={
                    providerLocations[activeRequest?.request._id!]?.latitude
                  }
                  destinationLongitude={
                    providerLocations[activeRequest?.request._id!]?.longitude
                  }
                  providers={providersForMap}
                  onTimesCalculated={() => {
                    /* can store times if needed */
                  }}
                />
              </View>
            ) : undefined}
          </>
        }
        ListEmptyComponent={
          <AppEmptyState
            icon="inbox"
            title="No active requests"
            body="When you submit a healthcare request, it will appear here. Track status and see provider details once they accept."
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[AUTH_COLORS.green]}
            tintColor={AUTH_COLORS.green}
          />
        }
      />
    </AppScreenShell>
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
  },
  // List already pads horizontally ? don't stack hero margin on top of it.
  heroFlush: {
    marginHorizontal: 0,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: 130,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
    flexShrink: 1,
  },
  requestCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  requestHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 12,
  },
  requestHeaderText: {
    flex: 1,
  },
  requestTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  requestDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.textMuted,
  },
  modeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#F0FDF4",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  modeText: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.greenDark,
  },
  providerCard: {
    backgroundColor: AUTH_COLORS.bg,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  providerCardLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: AUTH_COLORS.green,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  providerHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  providerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  providerIdentity: {
    flex: 1,
  },
  providerName: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  providerRoleText: {
    fontSize: 12,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    textTransform: "capitalize",
    marginTop: 2,
  },
  providerPhoneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  providerPhone: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  providerBio: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    marginTop: 8,
    lineHeight: 18,
  },
  paymentInstructionCard: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  paymentInstructionTitle: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: AUTH_COLORS.green,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  paymentInstructionText: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    lineHeight: 19,
  },
  paymentInstructionStrong: {
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  paymentInstructionPhone: {
    fontSize: 16,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    marginTop: 10,
    letterSpacing: 0.3,
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  etaText: {
    fontSize: 13,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  metaCard: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    backgroundColor: AUTH_COLORS.bg,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaText: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    flex: 1,
  },
  expiryText: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    marginBottom: 12,
  },
  expiryStrong: {
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  actionPrimary: {
    minHeight: 50,
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  actionSecondary: {
    minHeight: 50,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
  },
  actionDanger: {
    minHeight: 48,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#FECACA",
  },
  actionDisabled: {
    opacity: 0.65,
  },
  actionIconOnPrimary: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  actionIconSoft: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  actionIconDanger: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  actionPrimaryText: {
    fontSize: 15,
    fontWeight: "800",
    color: AUTH_COLORS.white,
  },
  actionSecondaryText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  actionDangerText: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.error,
  },
  prescriptionSection: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.bg,
    gap: 10,
  },
  prescriptionStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  prescriptionStatusText: {
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
    color: AUTH_COLORS.textMuted,
    lineHeight: 18,
  },
});
