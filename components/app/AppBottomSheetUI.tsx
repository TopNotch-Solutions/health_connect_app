import { Feather } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { AUTH_COLORS } from "../../lib/authScreenTheme";

/** Shared @gorhom/bottom-sheet chrome matching app mint/green theme */
export const appBottomSheetAppearance = {
  backgroundStyle: {
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderBottomWidth: 0,
  },
  handleIndicatorStyle: {
    backgroundColor: AUTH_COLORS.green,
    width: 48,
    height: 5,
    borderRadius: 999,
    marginTop: 6,
  },
} as const;

export const appBottomSheetScrollPadding = {
  paddingTop: 20,
  paddingHorizontal: 24,
};

export function AppBottomSheetHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={appBottomSheetStyles.header}>
      <Text style={appBottomSheetStyles.title}>{title}</Text>
      {subtitle ? (
        <Text style={appBottomSheetStyles.subtitle}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

export function AppBottomSheetCloseHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <View style={appBottomSheetStyles.closeHeaderRow}>
      <Text style={appBottomSheetStyles.title}>{title}</Text>
      <TouchableOpacity
        onPress={onClose}
        style={appBottomSheetStyles.closeBtn}
        hitSlop={12}
        activeOpacity={0.85}
      >
        <Feather name="x" size={22} color={AUTH_COLORS.textDark} />
      </TouchableOpacity>
    </View>
  );
}

export const appBottomSheetStyles = StyleSheet.create({
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 15,
    color: AUTH_COLORS.textMuted,
    marginTop: 6,
    lineHeight: 22,
  },
  closeHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  contactCard: {
    backgroundColor: AUTH_COLORS.white,
    padding: 22,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    alignItems: "center",
    marginBottom: 14,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  contactIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  contactTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 6,
  },
  contactText: {
    fontSize: 15,
    color: AUTH_COLORS.textMuted,
  },
  ambulanceCard: {
    backgroundColor: AUTH_COLORS.white,
    padding: 22,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    alignItems: "center",
    marginBottom: 24,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 2,
  },
  ambulanceImage: {
    width: 120,
    height: 120,
    marginBottom: 14,
  },
  ambulanceTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
    marginBottom: 10,
    textAlign: "center",
  },
  ambulanceDescription: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    lineHeight: 21,
    marginBottom: 18,
  },
  ambulanceButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 999,
    gap: 8,
  },
  ambulanceButtonText: {
    color: AUTH_COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
  sectionContainer: {
    backgroundColor: AUTH_COLORS.white,
    padding: 18,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginLeft: 10,
  },
  sectionText: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    lineHeight: 21,
    marginBottom: 10,
  },
  bulletList: {
    marginTop: 4,
  },
  bulletItem: {
    flexDirection: "row",
    marginBottom: 8,
    paddingLeft: 2,
  },
  bullet: {
    fontSize: 15,
    color: AUTH_COLORS.green,
    marginRight: 10,
    fontWeight: "700",
  },
  bulletText: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    lineHeight: 20,
    flex: 1,
  },
  boldText: {
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  footerContainer: {
    backgroundColor: AUTH_COLORS.greenSoft,
    padding: 16,
    borderRadius: 14,
    marginBottom: 24,
    borderLeftWidth: 4,
    borderLeftColor: AUTH_COLORS.green,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  footerText: {
    fontSize: 14,
    color: AUTH_COLORS.textDark,
    lineHeight: 20,
  },
  documentCard: {
    backgroundColor: AUTH_COLORS.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    marginBottom: 12,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  documentCardUploading: {
    opacity: 0.6,
  },
  documentCardContent: {
    flexDirection: "row",
    alignItems: "center",
  },
  documentIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  documentTextContainer: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 4,
  },
  documentSubtitle: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
  },
  packageCard: {
    marginBottom: 14,
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  packageCardInner: {
    padding: 18,
  },
  packageBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    marginBottom: 8,
  },
  packageBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: AUTH_COLORS.green,
  },
  packagePrice: {
    fontSize: 24,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  packageMeta: {
    fontSize: 12,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  packageHint: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    marginTop: 6,
  },
  primaryCta: {
    backgroundColor: AUTH_COLORS.green,
    paddingVertical: 16,
    borderRadius: 999,
    alignItems: "center",
    marginTop: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AUTH_COLORS.greenDark,
  },
  primaryCtaText: {
    color: AUTH_COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: AUTH_COLORS.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    marginBottom: 4,
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  inputError: {
    borderColor: AUTH_COLORS.error,
  },
  fieldError: {
    fontSize: 12,
    color: AUTH_COLORS.error,
    marginBottom: 8,
  },
  infoBanner: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.greenSoft,
    padding: 16,
  },
  infoBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  infoBannerBody: {
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
    marginTop: 6,
    lineHeight: 20,
  },
  warningBanner: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#FCD34D",
    backgroundColor: "#FFFBEB",
    padding: 16,
  },
  warningBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#92400E",
  },
  warningBannerBody: {
    fontSize: 14,
    color: "#B45309",
    marginTop: 6,
    lineHeight: 20,
  },
  noticeBanner: {
    marginTop: 16,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    padding: 16,
  },
  noticeBannerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E40AF",
  },
  noticeBannerBody: {
    fontSize: 14,
    color: "#1D4ED8",
    marginTop: 6,
    lineHeight: 20,
  },
  emptyStateText: {
    fontSize: 15,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    marginTop: 40,
  },
  loadingWrap: {
    marginTop: 40,
    alignItems: "center",
  },
  loadingLabel: {
    fontSize: 15,
    color: AUTH_COLORS.textMuted,
    marginTop: 12,
  },
});

/** Modal-based bottom sheets (slide-up) matching the same mint/green chrome */
export const appModalBottomSheetStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  overlayCenter: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  sheet: {
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderBottomWidth: 0,
  },
  sheetTall: {
    flex: 1,
    marginTop: "10%",
  },
  sheetCompact: {
    maxHeight: "85%",
    paddingBottom: 8,
  },
  handle: {
    width: 48,
    height: 5,
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 999,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  footer: {
    padding: 20,
    borderTopWidth: 2,
    borderTopColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.bg,
  },
  centeredCard: {
    backgroundColor: AUTH_COLORS.bg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    width: "100%",
    maxWidth: 400,
    maxHeight: "90%",
    padding: 20,
    alignItems: "center",
  },
});
