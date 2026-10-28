import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { AlertDialogHost } from "./AlertDialog";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import { KEYBOARD_AWARE_EXTRA_SCROLL } from "./ScreenLayout";

type ProfileFeatureShellProps = {
  visible: boolean;
  onClose: () => void;
  kicker: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  keyboard?: boolean;
  /** Full-screen overlay rendered inside this Modal (e.g. document preview). */
  overlay?: React.ReactNode;
};

export function ProfileFeatureShell({
  visible,
  onClose,
  kicker,
  title,
  subtitle,
  children,
  footer,
  keyboard = false,
  overlay,
}: ProfileFeatureShellProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.root}>
        <SafeAreaView edges={["top"]} style={styles.topSafe}>
          <View style={styles.hero}>
            <View style={styles.heroOrb} pointerEvents="none" />
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <Feather name="x" size={20} color={AUTH_COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.heroKicker}>{kicker}</Text>
            <Text style={styles.heroTitle}>{title}</Text>
            <Text style={styles.heroSub}>{subtitle}</Text>
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          <KeyboardAwareScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            enableOnAndroid={keyboard}
            enableAutomaticScroll={keyboard}
            extraScrollHeight={keyboard ? KEYBOARD_AWARE_EXTRA_SCROLL : 0}
            extraHeight={footer ? 120 : 40}
          >
            {children}
          </KeyboardAwareScrollView>
          {footer ? (
            <SafeAreaView edges={["bottom"]} style={styles.footerSafe}>
              <View style={styles.footer}>{footer}</View>
            </SafeAreaView>
          ) : (
            <SafeAreaView edges={["bottom"]} style={styles.footerSafe} />
          )}
        </View>
        {/* Host inside Modal so custom alerts can present over this screen (iOS). */}
        <AlertDialogHost active={visible} embedded />
        {overlay}
      </View>
    </Modal>
  );
}

export function ProfileSectionRail({ title }: { title: string }) {
  return (
    <View style={styles.sectionRail}>
      <View style={styles.railBar} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export const profileFeatureStyles = StyleSheet.create({
  fieldBlock: {
    marginBottom: 18,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D1D5DB",
  },
  fieldBlockLast: {
    borderBottomWidth: 0,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  primaryButton: {
    backgroundColor: "#0F3D24",
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: AUTH_COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
  secondaryButton: {
    marginTop: 10,
    backgroundColor: AUTH_COLORS.greenSoft,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  secondaryButtonText: {
    color: AUTH_COLORS.textDark,
    fontSize: 15,
    fontWeight: "600",
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F3D24",
  },
  topSafe: {
    backgroundColor: "#0F3D24",
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    overflow: "hidden",
  },
  heroOrb: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(34, 197, 94, 0.28)",
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(187, 247, 208, 0.95)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: AUTH_COLORS.white,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.78)",
    maxWidth: 320,
  },
  body: {
    flex: 1,
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    overflow: "hidden",
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  footerSafe: {
    backgroundColor: AUTH_COLORS.bg,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.bg,
  },
  sectionRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    marginTop: 4,
  },
  railBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: AUTH_COLORS.green,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
});
