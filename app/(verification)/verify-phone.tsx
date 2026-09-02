import { Feather } from "@expo/vector-icons";
import axios from "axios";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  iosInputIconSize,
  withIosInputContainerStyle,
  withIosTextInputStyle,
} from "../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../components/AppTextInput";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AuthScreenLayout from "../../components/AuthScreenLayout";
import { AuthTopBackButton } from "../../components/AuthTopBackButton";
import apiClient from "../../lib/api";
import { AUTH_COLORS, authScreenStyles } from "../../lib/authScreenTheme";

const VerifyPhoneScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async (): Promise<void> => {
    let sanitizedNumber = phoneNumber.replace(/\D/g, "");
    if (sanitizedNumber.startsWith("264"))
      sanitizedNumber = sanitizedNumber.slice(3);

    if (sanitizedNumber.length !== 9) {
      return Alert.alert(
        "Invalid Number",
        "Please enter a valid 9-digit Namibian number (e.g., 81 234 5678).",
      );
    }

    setIsLoading(true);

    const fullPhoneNumber = `264${sanitizedNumber}`;

    try {
      const response = await apiClient.post("/auth/send-otp", {
        cellphoneNumber: fullPhoneNumber,
      });

      if (response.status === 200) {
        router.push({
          pathname: "/verify-otp",
          params: {
            phoneNumber: fullPhoneNumber,
            flow: params.flow,
            role: params.role,
          },
        });
      }
    } catch (err: unknown) {
      let errorMessage = "An error occurred. Please try again.";
      if (axios.isAxiosError(err)) {
        errorMessage =
          (err.response?.data as { message?: string } | undefined)?.message ??
          err.message ??
          errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      Alert.alert("Error", errorMessage);
    } finally {
      setIsLoading(false);
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
            onPress={handleSendCode}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color={AUTH_COLORS.white} size="small" />
            ) : (
              <View style={styles.ctaRow}>
                <Text style={authScreenStyles.ctaText}>
                  Send Verification Code
                </Text>
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
      <Text style={authScreenStyles.sectionTitle}>Verify Your Phone</Text>
      <Text style={styles.subtitle}>
        We&apos;ll send you a verification code to confirm your number
      </Text>

      <Text style={authScreenStyles.inputLabel}>Phone Number</Text>
      <View
        style={[
          styles.phoneField,
          withIosInputContainerStyle({ borderColor: AUTH_COLORS.inputBorder }),
        ]}
      >
        <Text style={styles.flag}>🇳🇦</Text>
        <Text style={styles.dialCode}>+264</Text>
        <View style={styles.divider} />
        <Feather name="phone" size={iosInputIconSize} color={AUTH_COLORS.green} />
        <TextInput
          style={[styles.phoneInput, withIosTextInputStyle()]}
          placeholder="81 234 5678"
          placeholderTextColor={AUTH_COLORS.placeholder}
          keyboardType="phone-pad"
          value={phoneNumber}
          onChangeText={setPhoneNumber}
          maxLength={12}
        />
      </View>
      <Text style={styles.hint}>Enter your 9-digit Namibian phone number</Text>
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
    marginBottom: 24,
  },
  phoneField: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 8,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  flag: {
    fontSize: 22,
    marginRight: 10,
  },
  dialCode: {
    fontSize: 16,
    fontWeight: "600",
    color: AUTH_COLORS.textDark,
    marginRight: 10,
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: AUTH_COLORS.inputBorder,
    marginRight: 10,
  },
  phoneInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  hint: {
    fontSize: 13,
    color: AUTH_COLORS.textMuted,
    marginLeft: 4,
  },
  ctaRow: {
    flexDirection: "row",
    alignItems: "center",
  },
});

export default VerifyPhoneScreen;
