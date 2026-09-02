import { Feather } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import React from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ScreenLayout, {
  KEYBOARD_AWARE_EXTRA_SCROLL,
  KEYBOARD_VERTICAL_OFFSET,
} from "./ScreenLayout";
import { AUTH_COLORS, authScreenStyles } from "../lib/authScreenTheme";

type AuthScreenLayoutProps = {
  children: React.ReactNode;
  greeting?: string;
  greetingSub?: string;
  scrollBottomPadding?: number;
  stickyFooter?: React.ReactNode;
  hideBrandHeader?: boolean;
  hideFooter?: boolean;
  extraScrollTopPadding?: number;
};

export function AuthBackgroundDecor() {
  return (
    <>
      <View style={authScreenStyles.bgBlobTop} pointerEvents="none" />
      <View style={authScreenStyles.bgBlobMid} pointerEvents="none" />
      <View style={authScreenStyles.bgBlobBottom} pointerEvents="none" />
    </>
  );
}

export function AuthBrandHeader() {
  return (
    <View style={authScreenStyles.brandRow}>
      <View style={authScreenStyles.logoGlow}>
        <Image
          source={require("../assets/images/connectlogo.png")}
          style={authScreenStyles.logo}
          resizeMode="contain"
        />
      </View>
      <View style={authScreenStyles.brandTextWrap}>
        <Text style={authScreenStyles.brandTitle}>Health Connect</Text>
        <Text style={authScreenStyles.brandSubtitle}>Namibia</Text>
      </View>
    </View>
  );
}

export function AuthScreenFooter() {
  return (
    <View style={authScreenStyles.footer}>
      <Text style={authScreenStyles.footerText}>
        A digital health solution by{" "}
        <Text
          style={authScreenStyles.footerLink}
          onPress={() => Linking.openURL("https://kopanovertex.com")}
        >
          Kopano-Vertex Trading CC
        </Text>
      </Text>
    </View>
  );
}

export function AuthProgressBar({
  step,
  totalSteps,
}: {
  step: number;
  totalSteps: number;
}) {
  return (
    <View style={authScreenStyles.progressRow}>
      <Text style={authScreenStyles.stepMeta}>
        Step {step} of {totalSteps}
      </Text>
      <View style={authScreenStyles.progressTrack}>
        <View
          style={[
            authScreenStyles.progressFill,
            { width: `${(step / totalSteps) * 100}%` },
          ]}
        />
      </View>
    </View>
  );
}

export default function AuthScreenLayout({
  children,
  greeting,
  greetingSub,
  scrollBottomPadding = 120,
  stickyFooter,
  hideBrandHeader = false,
  hideFooter = false,
  extraScrollTopPadding = 0,
}: AuthScreenLayoutProps) {
  const insets = useSafeAreaInsets();
  const footerBottomPad = Math.max(insets.bottom, 8);
  const baseScrollTop = Platform.OS === "ios" ? 8 : 24;

  return (
    <ScreenLayout backgroundColor={AUTH_COLORS.bg}>
      <View style={authScreenStyles.root}>
        <View style={authScreenStyles.bgBlobTop} pointerEvents="none" />
        <View style={authScreenStyles.bgBlobMid} pointerEvents="none" />
        <View style={authScreenStyles.bgBlobBottom} pointerEvents="none" />

        <View style={authScreenStyles.content}>
          <KeyboardAvoidingView
            style={authScreenStyles.flex}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
          >
            <KeyboardAwareScrollView
              style={authScreenStyles.flex}
              contentContainerStyle={[
                authScreenStyles.scrollContent,
                {
                  paddingTop: baseScrollTop + extraScrollTopPadding,
                  paddingBottom: scrollBottomPadding,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              enableOnAndroid
              enableAutomaticScroll
              extraScrollHeight={KEYBOARD_AWARE_EXTRA_SCROLL}
            >
              {!hideBrandHeader ? <AuthBrandHeader /> : null}
              {greeting ? (
                <Text style={authScreenStyles.greeting}>{greeting}</Text>
              ) : null}
              {greetingSub ? (
                <Text style={authScreenStyles.greetingSub}>{greetingSub}</Text>
              ) : null}
              {children}
            </KeyboardAwareScrollView>

            {stickyFooter ? (
              <View
                style={[
                  authScreenStyles.stickyFooter,
                  { paddingBottom: footerBottomPad },
                ]}
              >
                {stickyFooter}
              </View>
            ) : null}
            {!hideFooter ? <AuthScreenFooter /> : null}
          </KeyboardAvoidingView>
        </View>
      </View>
      <StatusBar backgroundColor={AUTH_COLORS.bg} style="dark" />
    </ScreenLayout>
  );
}

type RegistrationStepFooterProps = {
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

export function RegistrationStepFooter({
  step,
  totalSteps,
  onBack,
  onNext,
  onSubmit,
  isLoading = false,
  nextDisabled = false,
  backDisabled = false,
  submitLabel = "Register",
}: RegistrationStepFooterProps) {
  const isLastStep = step >= totalSteps;
  const primaryDisabled =
    isLoading || (!isLastStep && nextDisabled);

  return (
    <View style={authScreenStyles.footerActionsRow}>
      {step > 1 ? (
        <TouchableOpacity
          onPress={onBack}
          disabled={backDisabled || isLoading}
          style={authScreenStyles.backButton}
          activeOpacity={0.85}
        >
          <Text style={authScreenStyles.backButtonText}>Back</Text>
        </TouchableOpacity>
      ) : null}

      <View style={[authScreenStyles.ctaGlowWrap, step > 1 ? authScreenStyles.flex : { flex: 1 }]}>
        <TouchableOpacity
          onPress={isLastStep ? onSubmit : onNext}
          disabled={primaryDisabled}
          style={[
            authScreenStyles.ctaButton,
            primaryDisabled && authScreenStyles.ctaButtonDisabled,
          ]}
          activeOpacity={0.85}
        >
          {isLoading && isLastStep ? (
            <ActivityIndicator color={AUTH_COLORS.white} size="small" />
          ) : (
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={authScreenStyles.ctaText}>
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
    </View>
  );
}
