import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AUTH_COLORS } from "../../lib/authScreenTheme";
import ConsultationDetailModal, {
  HistoryItem,
} from "./ConsultationDetailModal";

export type { HistoryItem };

const HistoryCard = ({ item }: { item: HistoryItem }) => {
  const [detailVisible, setDetailVisible] = useState(false);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case "completed":
        return {
          color: "#059669",
          bgColor: "#D1FAE5",
          icon: "check-circle",
        };
      case "cancelled":
        return {
          color: "#DC2626",
          bgColor: "#FEE2E2",
          icon: "x-circle",
        };
      case "pending":
      case "searching":
        return {
          color: "#D97706",
          bgColor: "#FEF3C7",
          icon: "clock",
        };
      case "accepted":
      case "en_route":
      case "arrived":
        return {
          color: "#2563EB",
          bgColor: "#DBEAFE",
          icon: "navigation",
        };
      default:
        return {
          color: "#4B5563",
          bgColor: "#F3F4F6",
          icon: "info",
        };
    }
  };

  const statusConfig = getStatusConfig(item.status);
  const statusText =
    item.status.charAt(0).toUpperCase() +
    item.status.slice(1).replace("_", " ");

  return (
    <>
      <TouchableOpacity
        style={styles.card}
        onPress={() => setDetailVisible(true)}
        activeOpacity={0.88}
      >
        <View
          style={[styles.accentBar, { backgroundColor: statusConfig.color }]}
        />

        <View style={styles.orbLarge} pointerEvents="none" />
        <View style={styles.orbSmall} pointerEvents="none" />

        <View style={styles.body}>
          <View style={styles.topRow}>
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <Feather
                name={statusConfig.icon as any}
                size={20}
                color={statusConfig.color}
              />
            </View>
            <View
              style={[
                styles.statusPill,
                { backgroundColor: statusConfig.bgColor },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  { backgroundColor: statusConfig.color },
                ]}
              />
              <Text
                style={[styles.statusText, { color: statusConfig.color }]}
                numberOfLines={1}
              >
                {statusText}
              </Text>
            </View>
          </View>

          <Text style={styles.ailment} numberOfLines={2}>
            {item.ailment}
          </Text>

          <View style={styles.footer}>
            <Feather name="calendar" size={12} color={AUTH_COLORS.textMuted} />
            <Text style={styles.date} numberOfLines={1}>
              {item.date}
            </Text>
            <Feather
              name="chevron-right"
              size={14}
              color={AUTH_COLORS.textMuted}
            />
          </View>
        </View>
      </TouchableOpacity>

      <ConsultationDetailModal
        visible={detailVisible}
        item={item}
        onClose={() => setDetailVisible(false)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: {
    width: "48%",
    marginBottom: 14,
    height: 156,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  accentBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
  },
  orbLarge: {
    position: "absolute",
    top: -24,
    right: -20,
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  orbSmall: {
    position: "absolute",
    bottom: -16,
    left: -12,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(134, 239, 172, 0.28)",
  },
  body: {
    flex: 1,
    paddingTop: 16,
    paddingHorizontal: 12,
    paddingBottom: 12,
    justifyContent: "space-between",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statusPill: {
    flexShrink: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.1,
  },
  ailment: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.2,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 8,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: "auto",
  },
  date: {
    flex: 1,
    fontSize: 11,
    fontWeight: "500",
    color: AUTH_COLORS.textMuted,
  },
});

export default HistoryCard;
