import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import { KEYBOARD_VERTICAL_OFFSET } from "./ScreenLayout";
import {
  ProfileSectionRail,
  profileFeatureStyles,
} from "./ProfileFeatureShell";

export { ProfileSectionRail, profileFeatureStyles };

type RegistrationFeatureShellProps = {
  step: number;
  totalSteps: number;
  title: string;
  subtitle: string;
  onBack: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

/**
 * Dark-hero registration chrome matching edit-profile layout:
 * green hero + overlapping light sheet + sticky footer actions.
 */
export default function RegistrationFeatureShell({
  step,
  totalSteps,
  title,
  subtitle,
  onBack,
  children,
  footer,
}: RegistrationFeatureShellProps) {
  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <SafeAreaView edges={["top"]} style={styles.topSafe}>
        <View style={styles.hero}>
          <View style={styles.heroOrb} pointerEvents="none" />
          <TouchableOpacity
            onPress={onBack}
            style={styles.backButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Feather name="arrow-left" size={20} color={AUTH_COLORS.white} />
          </TouchableOpacity>

          <Text style={styles.heroKicker}>
            Step {step} of {totalSteps}
          </Text>
          <Text style={styles.heroTitle}>{title}</Text>
          <Text style={styles.heroSub}>{subtitle}</Text>

          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${(step / totalSteps) * 100}%` },
              ]}
            />
          </View>
        </View>
      </SafeAreaView>

      <KeyboardAvoidingView
        style={styles.body}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>

        {footer ? (
          <SafeAreaView edges={["bottom"]} style={styles.footerSafe}>
            <View style={styles.footer}>{footer}</View>
          </SafeAreaView>
        ) : (
          <SafeAreaView edges={["bottom"]} style={styles.footerSafe} />
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

type RegistrationStepActionsProps = {
  step: number;
  totalSteps: number;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
  isLoading?: boolean;
  nextDisabled?: boolean;
  backDisabled?: boolean;
  submitLabel?: string;
};

export function RegistrationStepActions({
  step,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isLoading = false,
  nextDisabled = false,
  backDisabled = false,
  submitLabel = "Register",
}: RegistrationStepActionsProps) {
  const isLastStep = step >= totalSteps;
  const primaryDisabled = isLoading || (!isLastStep && nextDisabled);

  return (
    <View style={styles.actionsRow}>
      {step > 1 ? (
        <TouchableOpacity
          onPress={onBack}
          disabled={backDisabled || isLoading}
          style={styles.secondaryAction}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryActionText}>Back</Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={isLastStep ? onSubmit : onNext}
        disabled={primaryDisabled}
        style={[
          styles.primaryAction,
          step > 1 ? styles.primaryActionFlex : styles.primaryActionFull,
          primaryDisabled && styles.primaryActionDisabled,
        ]}
        activeOpacity={0.85}
      >
        {isLoading && isLastStep ? (
          <ActivityIndicator color={AUTH_COLORS.white} size="small" />
        ) : (
          <View style={styles.primaryActionInner}>
            <Text style={styles.primaryActionText}>
              {isLastStep ? submitLabel : "Next"}
            </Text>
            {!isLastStep ? (
              <Feather
                name="arrow-right"
                size={18}
                color={AUTH_COLORS.white}
                style={{ marginLeft: 8 }}
              />
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

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
    paddingTop: 12,
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
  backButton: {
    alignSelf: "flex-start",
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
    fontSize: 30,
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
    marginBottom: 18,
  },
  progressTrack: {
    height: 6,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.18)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 999,
    backgroundColor: "#86EFAC",
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
    paddingBottom: 24,
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
  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  secondaryAction: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  secondaryActionText: {
    color: AUTH_COLORS.textDark,
    fontSize: 15,
    fontWeight: "700",
  },
  primaryAction: {
    backgroundColor: "#0F3D24",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryActionFlex: {
    flex: 1,
  },
  primaryActionFull: {
    flex: 1,
  },
  primaryActionDisabled: {
    opacity: 0.55,
  },
  primaryActionInner: {
    flexDirection: "row",
    alignItems: "center",
  },
  primaryActionText: {
    color: AUTH_COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
