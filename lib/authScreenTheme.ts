import { Platform, StyleSheet } from "react-native";

export const AUTH_COLORS = {
  bg: "#FAFFFE",
  textDark: "#14532D",
  textMuted: "#4B5563",
  green: "#16A34A",
  greenDark: "#15803D",
  greenSoft: "rgba(187, 247, 208, 0.45)",
  placeholder: "#C4A574",
  inputBorder: "#BBF7D0",
  white: "#FFFFFF",
  footer: "#6B7280",
  error: "#EF4444",
};

export function authInputBorder(hasError?: boolean) {
  return hasError ? AUTH_COLORS.error : AUTH_COLORS.inputBorder;
}

export const authScreenStyles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH_COLORS.bg,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 28,
    paddingTop: Platform.OS === "ios" ? 8 : 24,
    paddingBottom: 16,
  },
  bgBlobTop: {
    position: "absolute",
    top: -40,
    right: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  bgBlobMid: {
    position: "absolute",
    top: 120,
    left: -80,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "rgba(134, 239, 172, 0.25)",
  },
  bgBlobBottom: {
    position: "absolute",
    bottom: 140,
    right: -40,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 8,
  },
  logoGlow: {
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  logo: {
    width: 72,
    height: 72,
  },
  brandTextWrap: {
    marginLeft: 14,
  },
  brandTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 22,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
    marginTop: -2,
  },
  greeting: {
    fontSize: 30,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 30,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    letterSpacing: -0.5,
    marginBottom: 20,
  },
  stepMeta: {
    fontSize: 15,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
    marginRight: 12,
  },
  progressTrack: {
    flex: 1,
    height: 8,
    backgroundColor: "#E5E7EB",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 999,
  },
  progressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 15,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
    marginBottom: 8,
    marginLeft: 4,
  },
  fieldError: {
    color: AUTH_COLORS.error,
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
    marginBottom: 12,
  },
  standaloneInput: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  disclaimerBox: {
    backgroundColor: "rgba(187, 247, 208, 0.35)",
    borderLeftWidth: 4,
    borderLeftColor: AUTH_COLORS.green,
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
  },
  disclaimerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 4,
  },
  disclaimerBody: {
    fontSize: 12,
    lineHeight: 18,
    color: AUTH_COLORS.textMuted,
  },
  stickyFooter: {
    paddingHorizontal: 28,
    paddingTop: 12,
    paddingBottom: 8,
    backgroundColor: AUTH_COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  footer: {
    paddingHorizontal: 28,
    paddingTop: 8,
    paddingBottom: 8,
    backgroundColor: AUTH_COLORS.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
  },
  footerText: {
    textAlign: "center",
    fontSize: 10,
    color: AUTH_COLORS.footer,
    lineHeight: 14,
  },
  footerLink: {
    color: AUTH_COLORS.footer,
    fontWeight: "600",
  },
  ctaGlowWrap: {
    flex: 1,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaGlowWrapBlock: {
    width: "100%",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.55,
    shadowRadius: 20,
    elevation: 10,
  },
  ctaButton: {
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AUTH_COLORS.greenDark,
  },
  ctaButtonDisabled: {
    backgroundColor: "#9CA3AF",
    borderColor: "#6B7280",
  },
  ctaText: {
    color: AUTH_COLORS.white,
    fontSize: 17,
    fontWeight: "700",
  },
  backButton: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#D1D5DB",
  },
  backButtonText: {
    color: AUTH_COLORS.textMuted,
    fontSize: 17,
    fontWeight: "600",
  },
  footerActionsRow: {
    flexDirection: "row",
    gap: 12,
  },
  topBackButton: {
    position: "absolute",
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 10,
    zIndex: 20,
  },
});

/** NativeWind class helpers for registration fields */
export const authInputClass = (hasError?: boolean) =>
  `bg-white p-4 rounded-xl mb-1 border-2 ${
    hasError ? "border-red-400" : "border-[#BBF7D0]"
  }`;

export const authLabelClass = "text-[15px] text-[#14532D] mb-2 font-semibold ml-1";

export const authSectionTitleClass = "text-[22px] font-bold text-[#14532D] mb-5";
