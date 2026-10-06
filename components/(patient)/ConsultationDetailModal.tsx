import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import {
  appBottomSheetStyles,
  appModalBottomSheetStyles,
} from "../app/AppBottomSheetUI";
import { AUTH_COLORS } from "../../lib/authScreenTheme";

export interface HistoryItem {
  _id: string;
  ailment: string;
  status: string;
  date: string;
  consultationMode?: "house_visit" | "video_consultation";
  paymentMethod?: "wallet" | "cash";
  urgency?: string;
  symptoms?: string;
  consultationCost?: number;
  providerName?: string;
  providerRole?: string;
  providerPhone?: string;
  estimatedArrival?: string;
  address?: {
    route?: string;
    locality?: string;
    region?: string;
  };
  createdAt?: string;
}

const getStatusConfig = (status: string) => {
  switch (status) {
    case "completed":
      return { color: "#059669", bgColor: "#D1FAE5", icon: "check-circle" as const };
    case "cancelled":
      return { color: "#DC2626", bgColor: "#FEE2E2", icon: "x-circle" as const };
    case "pending":
    case "searching":
      return { color: "#D97706", bgColor: "#FEF3C7", icon: "clock" as const };
    case "accepted":
    case "en_route":
    case "arrived":
      return { color: "#2563EB", bgColor: "#DBEAFE", icon: "navigation" as const };
    case "payment_pending":
    case "paid":
      return { color: "#D97706", bgColor: "#FEF3C7", icon: "credit-card" as const };
    case "in_call":
    case "ready_for_call":
      return { color: "#0284C7", bgColor: "#E0F2FE", icon: "video" as const };
    case "in_progress":
      return { color: "#EA580C", bgColor: "#FFEDD5", icon: "activity" as const };
    default:
      return { color: "#4B5563", bgColor: "#F3F4F6", icon: "info" as const };
  }
};

const getStatusDescription = (item: HistoryItem) => {
  switch (item.status) {
    case "searching":
      return "Searching for available providers...";
    case "pending":
      return "Request sent to provider, waiting for response...";
    case "accepted":
      return item.providerName
        ? `Provider ${item.providerName} accepted your request`
        : "A provider has accepted your request";
    case "payment_pending":
      return "Complete payment to continue with your consultation.";
    case "paid":
      return "Payment received. Waiting for provider confirmation.";
    case "provider_confirmation_pending":
      return "Waiting for your provider to confirm readiness.";
    case "ready_for_call":
      return "Your teleconsultation is ready to begin.";
    case "in_call":
      return "Video consultation is in progress.";
    case "en_route":
      return item.estimatedArrival
        ? `Provider is on the way (ETA: ${item.estimatedArrival})`
        : "Provider is on the way to your location.";
    case "arrived":
      return "Provider has arrived at your location.";
    case "in_progress":
      return "Consultation is in progress...";
    case "completed":
      return "Consultation has been completed.";
    case "cancelled":
      return "Request was cancelled.";
    case "expired":
      return "Request expired — no providers available.";
    case "rejected":
      return "Request was rejected.";
    default:
      return item.status.replace(/_/g, " ");
  }
};

const DetailRow = ({
  icon,
  label,
  value,
}: {
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  value: string;
}) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIcon}>
      <Feather name={icon} size={16} color={AUTH_COLORS.green} />
    </View>
    <View style={styles.detailText}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

type ConsultationDetailModalProps = {
  visible: boolean;
  item: HistoryItem | null;
  onClose: () => void;
};

export default function ConsultationDetailModal({
  visible,
  item,
  onClose,
}: ConsultationDetailModalProps) {
  if (!item) return null;

  const statusConfig = getStatusConfig(item.status);
  const statusText =
    item.status.charAt(0).toUpperCase() +
    item.status.slice(1).replace(/_/g, " ");

  const addressParts = [
    item.address?.route,
    item.address?.locality,
    item.address?.region,
  ].filter(Boolean);
  const addressText = addressParts.length > 0 ? addressParts.join(", ") : null;

  const consultationLabel =
    item.consultationMode === "video_consultation"
      ? "Video Consultation"
      : item.consultationMode === "house_visit"
        ? "House Visit"
        : null;

  const paymentLabel =
    item.paymentMethod === "wallet"
      ? "Wallet"
      : item.paymentMethod === "cash"
        ? "Cash"
        : null;

  const showProvider =
    !!item.providerName &&
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
    ].includes(item.status);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={appModalBottomSheetStyles.overlay}>
        <View
          style={[
            appModalBottomSheetStyles.sheet,
            appModalBottomSheetStyles.sheetCompact,
          ]}
        >
          <View style={appModalBottomSheetStyles.handle} />

          <View style={styles.headerRow}>
            <Text style={styles.title}>Consultation details</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              hitSlop={12}
              activeOpacity={0.85}
            >
              <Feather name="x" size={22} color={AUTH_COLORS.textDark} />
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
            <Text style={styles.ailment}>{item.ailment}</Text>

            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <Feather
                name={statusConfig.icon}
                size={14}
                color={statusConfig.color}
              />
              <Text style={[styles.statusText, { color: statusConfig.color }]}>
                {statusText}
              </Text>
            </View>

            <Text style={styles.description}>
              {getStatusDescription(item)}
            </Text>

            <View style={styles.section}>
              <DetailRow icon="calendar" label="Requested" value={item.date} />
              {consultationLabel ? (
                <DetailRow
                  icon={
                    item.consultationMode === "video_consultation"
                      ? "video"
                      : "home"
                  }
                  label="Consultation type"
                  value={consultationLabel}
                />
              ) : null}
              {item.urgency ? (
                <DetailRow
                  icon="alert-circle"
                  label="Urgency"
                  value={
                    item.urgency.charAt(0).toUpperCase() + item.urgency.slice(1)
                  }
                />
              ) : null}
              {paymentLabel ? (
                <DetailRow
                  icon="credit-card"
                  label="Payment method"
                  value={paymentLabel}
                />
              ) : null}
              {typeof item.consultationCost === "number" ? (
                <DetailRow
                  icon="dollar-sign"
                  label="Consultation cost"
                  value={`N$ ${item.consultationCost.toFixed(2)}`}
                />
              ) : null}
              {addressText ? (
                <DetailRow icon="map-pin" label="Location" value={addressText} />
              ) : null}
              {item.symptoms ? (
                <DetailRow
                  icon="file-text"
                  label="Symptoms"
                  value={item.symptoms}
                />
              ) : null}
              {item.estimatedArrival ? (
                <DetailRow
                  icon="clock"
                  label="Estimated arrival"
                  value={item.estimatedArrival}
                />
              ) : null}
            </View>

            {showProvider ? (
              <View style={styles.providerCard}>
                <Text style={styles.providerLabel}>Provider</Text>
                <View style={styles.providerRow}>
                  <View style={styles.providerAvatar}>
                    <Feather name="user" size={18} color={AUTH_COLORS.green} />
                  </View>
                  <View style={styles.providerInfo}>
                    <Text style={styles.providerName}>{item.providerName}</Text>
                    {item.providerRole ? (
                      <Text style={styles.providerMeta}>
                        {item.providerRole.charAt(0).toUpperCase() +
                          item.providerRole.slice(1)}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ) : null}
          </ScrollView>

          <View style={appModalBottomSheetStyles.footer}>
            <TouchableOpacity
              style={appBottomSheetStyles.primaryCta}
              onPress={onClose}
              activeOpacity={0.85}
            >
              <Text style={appBottomSheetStyles.primaryCtaText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  ailment: {
    fontSize: 20,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 10,
  },
  statusPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  statusText: {
    fontSize: 13,
    fontWeight: "700",
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
    marginBottom: 18,
  },
  section: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 14,
    gap: 14,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
    lineHeight: 20,
  },
  providerCard: {
    backgroundColor: AUTH_COLORS.greenSoft,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 14,
    marginBottom: 8,
  },
  providerLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: AUTH_COLORS.green,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  providerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  providerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AUTH_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  providerMeta: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginTop: 2,
  },
});
