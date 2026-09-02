import { Feather } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useRef, useState } from "react";
import {
  withIosOtpTextInputStyle,
} from "../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../components/AppTextInput";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AuthScreenLayout from "../../components/AuthScreenLayout";
import { AuthTopBackButton } from "../../components/AuthTopBackButton";
import apiClient from "../../lib/api";
import { AUTH_COLORS, authScreenStyles } from "../../lib/authScreenTheme";

const OTPScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(""));
  const inputs = useRef<(RNTextInput | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  const role: "provider" | "patient" =
    typeof params.role === "string" && params.role === "provider"
      ? "provider"
      : "patient";

  const cellphoneNumber =
    (typeof params.cellphoneNumber === "string" && params.cellphoneNumber) ||
    (typeof params.phoneNumber === "string" && params.phoneNumber) ||
    "";

  const handleOtpChange = (text: string, index: number) => {
    if (isNaN(Number(text))) return;
    const next = [...otp];
    next[index] = text;
    setOtp(next);
    if (text && index < 5) inputs.current[index + 1]?.focus();
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerifyOtp = () => {
    const finalOtp = otp.join("");
    if (finalOtp.length < 6) {
      return Alert.alert(
        "Invalid Code",
        "Please enter the complete 6-digit code.",
      );
    }
    if (!cellphoneNumber) {
      return Alert.alert(
        "Error",
        "Missing phone number. Please go back and try again.",
      );
    }

    setIsLoading(true);

    let promise;
    const isResetFlow =
      typeof params.flow === "string" && params.flow === "resetPassword";

    if (isResetFlow) {
      promise = apiClient.post("/app/auth/forgot-password-verify-otp", {
        cellphoneNumber,
        otp: finalOtp,
      });
    } else {
      promise = apiClient.post("/auth/verify-otp", {
        cellphoneNumber,
        otp: finalOtp,
      });
    }

    promise
      .then((response) => {
        setIsLoading(false);

        if (isResetFlow) {
          if (response.status === 200 && response.data?.userId) {
            router.replace({
              pathname: "/(auth)/reset-password",
              params: { userId: String(response.data.userId) },
            });
          } else {
            Alert.alert(
              "Verification Failed",
              response.data?.message || "User ID not found in response.",
            );
          }
        } else {
          const { activeUser } = response.data || {};
          if (activeUser) {
            router.replace("/(root)/sign-in");
          } else if (role === "provider") {
            router.replace({
              pathname: "/(auth)/(provider)/provider-type",
              params: { cellphoneNumber },
            });
          } else {
            router.replace({
              pathname: "/(auth)/(patient)/registration",
              params: { cellphoneNumber },
            });
          }
        }
      })
      .catch((error) => {
        setIsLoading(false);
        const errorMessage =
          error.response?.data?.message ||
          "A network error occurred. Please check your connection and the API endpoint.";
        Alert.alert("Verification Failed", errorMessage);
      });
  };

  const handleResendOtp = async () => {
    if (!cellphoneNumber) {
      return Alert.alert("Error", "Could not resend code. Please go back.");
    }
    setIsResending(true);
    try {
      await apiClient.post("/auth/send-otp", { cellphoneNumber });
      Alert.alert(
        "Code Resent",
        "A new verification code has been sent to your phone.",
      );
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "An error occurred.";
      Alert.alert("Error", errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <View style={styles.screen}>
      <AuthScreenLayout
        hideBrandHeader
        hideFooter
        extraScrollTopPadding={56}
        scrollBottomPadding={24}
      stickyFooter={
        <View style={authScreenStyles.ctaGlowWrapBlock}>
          <TouchableOpacity
            style={[
              authScreenStyles.ctaButton,
              isLoading && authScreenStyles.ctaButtonDisabled,
            ]}
            onPress={handleVerifyOtp}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={AUTH_COLORS.white} size="small" />
            ) : (
              <View style={styles.ctaRow}>
                <Text style={authScreenStyles.ctaText}>Verify & Continue</Text>
                <Feather
                  name="arrow-right"
                  size={18}
                  color={AUTH_COLORS.white}
                  style={{ marginLeft: 8 }}
                />
              </View>
            )}
          </TouchableOpacity>
        </View>
      }
    >
      <Text style={authScreenStyles.sectionTitle}>Verify Your Code</Text>
      <Text style={styles.subtitle}>
        Enter the 6-digit code sent to{"\n"}
        <Text style={styles.phoneHighlight}>
          {cellphoneNumber || "your number"}
        </Text>
      </Text>

      <View style={styles.otpRow}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref: RNTextInput | null) => {
              inputs.current[index] = ref;
            }}
            style={[
              styles.otpBox,
              withIosOtpTextInputStyle({
                shadowColor: AUTH_COLORS.green,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.12,
                shadowRadius: 6,
                elevation: 3,
              }),
            ]}
            keyboardType="number-pad"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleOtpChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
          />
        ))}
      </View>

      <View style={styles.resendRow}>
        <Text style={styles.resendMuted}>Didn&apos;t receive code? </Text>
        <TouchableOpacity onPress={handleResendOtp} disabled={isResending}>
          {isResending ? (
            <ActivityIndicator size="small" color={AUTH_COLORS.green} />
          ) : (
            <Text style={styles.resendLink}>Resend</Text>
          )}
        </TouchableOpacity>
      </View>
      </AuthScreenLayout>

      <AuthTopBackButton accessibilityLabel="Go back" />
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    marginBottom: 28,
  },
  phoneHighlight: {
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  otpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  otpBox: {
    width: 48,
    height: 56,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    textAlign: "center",
    fontSize: 22,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  resendRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  resendMuted: {
    fontSize: 15,
    color: AUTH_COLORS.textMuted,
  },
  resendLink: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.green,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default OTPScreen;
