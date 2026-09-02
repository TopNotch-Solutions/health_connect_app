import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import { iosInputIconSize, withIosInputContainerStyle, withIosMultilineTextInputStyle, withIosOtpTextInputStyle, withIosStandaloneTextInputStyle, withIosTextInputStyle } from "../lib/iosInputStyles";
import { AppTextInput as TextInput } from "./AppTextInput";
import { ActivityIndicator, Alert, Dimensions, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  AppBottomSheetCloseHeader,
  appBottomSheetAppearance,
  appBottomSheetStyles,
  appModalBottomSheetStyles,
} from "./app/AppBottomSheetUI";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");
const MAX_HEIGHT = SCREEN_HEIGHT * 0.8;

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswords, setShowPasswords] = useState({
    currentPassword: false,
    newPassword: false,
    confirmPassword: false,
  });
  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleChangePassword = async () => {
    // Clear previous errors
    setErrors({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    });

    let hasError = false;
    const newErrors = {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    };

    // Validate fields
    if (!passwords.currentPassword.trim()) {
      newErrors.currentPassword = "Current password is required";
      hasError = true;
    }
    if (!passwords.newPassword.trim()) {
      newErrors.newPassword = "New password is required";
      hasError = true;
    }
    if (!passwords.confirmPassword.trim()) {
      newErrors.confirmPassword = "Please confirm your new password";
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    if (passwords.newPassword.length < 8) {
      newErrors.newPassword = "Password must be at least 8 characters long";
      hasError = true;
    }

    if (passwords.newPassword !== passwords.confirmPassword) {
      newErrors.confirmPassword = "New passwords do not match";
      hasError = true;
    }

    if (passwords.currentPassword === passwords.newPassword) {
      newErrors.newPassword =
        "New password must be different from current password";
      hasError = true;
    }

    if (hasError) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    try {
      await apiClient.patch("/app/auth/change-password/", {
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
        confirmPassword: passwords.confirmPassword,
      });

      Alert.alert("Success", "Password changed successfully");
      setPasswords({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setErrors({ currentPassword: "", newPassword: "", confirmPassword: "" });
      onClose();
    } catch (error: any) {
      Alert.alert(
        "Error",
        error.response?.data?.message || "Failed to change password",
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={() => {
        setErrors({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        setPasswords({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
        onClose();
      }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setErrors({
              currentPassword: "",
              newPassword: "",
              confirmPassword: "",
            });
            setPasswords({
              currentPassword: "",
              newPassword: "",
              confirmPassword: "",
            });
            onClose();
          }}
          style={styles.overlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={[styles.bottomSheet, { height: MAX_HEIGHT }]}>
              <View style={appModalBottomSheetStyles.handle} />

              <View style={styles.header}>
                <AppBottomSheetCloseHeader
                  title="Change Password"
                  onClose={() => {
                    setErrors({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setPasswords({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    onClose();
                  }}
                />
              </View>

              <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {/* Current Password */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Current Password</Text>
                  <View
                    style={withIosInputContainerStyle([
                      styles.inputWrapper,
                      errors.currentPassword && styles.inputWrapperError,
                    ])}
                  >
                    <TextInput
                      style={withIosTextInputStyle(styles.input)}
                      placeholder="Enter current password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPasswords.currentPassword}
                      value={passwords.currentPassword}
                      onChangeText={(text) => {
                        setPasswords({ ...passwords, currentPassword: text });
                        if (errors.currentPassword) {
                          setErrors({ ...errors, currentPassword: "" });
                        }
                      }}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowPasswords({
                          ...showPasswords,
                          currentPassword: !showPasswords.currentPassword,
                        })
                      }
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={showPasswords.currentPassword ? "eye" : "eye-off"}
                        size={20}
                        color={errors.currentPassword ? "#EF4444" : "#6B7280"}
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.currentPassword ? (
                    <Text style={styles.errorText}>
                      {errors.currentPassword}
                    </Text>
                  ) : null}
                </View>

                {/* New Password */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>New Password</Text>
                  <View
                    style={withIosInputContainerStyle([
                      styles.inputWrapper,
                      errors.newPassword && styles.inputWrapperError,
                    ])}
                  >
                    <TextInput
                      style={withIosTextInputStyle(styles.input)}
                      placeholder="Enter new password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPasswords.newPassword}
                      value={passwords.newPassword}
                      onChangeText={(text) => {
                        setPasswords({ ...passwords, newPassword: text });
                        if (errors.newPassword) {
                          setErrors({ ...errors, newPassword: "" });
                        }
                      }}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowPasswords({
                          ...showPasswords,
                          newPassword: !showPasswords.newPassword,
                        })
                      }
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={showPasswords.newPassword ? "eye" : "eye-off"}
                        size={20}
                        color={errors.newPassword ? "#EF4444" : "#6B7280"}
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.newPassword ? (
                    <Text style={styles.errorText}>{errors.newPassword}</Text>
                  ) : null}
                </View>

                {/* Confirm Password */}
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm Password</Text>
                  <View
                    style={withIosInputContainerStyle([
                      styles.inputWrapper,
                      errors.confirmPassword && styles.inputWrapperError,
                    ])}
                  >
                    <TextInput
                      style={withIosTextInputStyle(styles.input)}
                      placeholder="Confirm new password"
                      placeholderTextColor="#9CA3AF"
                      secureTextEntry={!showPasswords.confirmPassword}
                      value={passwords.confirmPassword}
                      onChangeText={(text) => {
                        setPasswords({ ...passwords, confirmPassword: text });
                        if (errors.confirmPassword) {
                          setErrors({ ...errors, confirmPassword: "" });
                        }
                      }}
                      editable={!isLoading}
                    />
                    <TouchableOpacity
                      onPress={() =>
                        setShowPasswords({
                          ...showPasswords,
                          confirmPassword: !showPasswords.confirmPassword,
                        })
                      }
                      style={styles.eyeButton}
                      activeOpacity={0.7}
                    >
                      <Feather
                        name={showPasswords.confirmPassword ? "eye" : "eye-off"}
                        size={20}
                        color={errors.confirmPassword ? "#EF4444" : "#6B7280"}
                      />
                    </TouchableOpacity>
                  </View>
                  {errors.confirmPassword ? (
                    <Text style={styles.errorText}>
                      {errors.confirmPassword}
                    </Text>
                  ) : null}
                </View>

                {/* Password Requirements */}
                <View style={[appBottomSheetStyles.noticeBanner, { marginBottom: 24 }]}>
                  <Text style={appBottomSheetStyles.noticeBannerTitle}>
                    Password Requirements:
                  </Text>
                  <Text style={styles.requirementsText}>
                    • At least 8 characters long
                  </Text>
                  <Text style={styles.requirementsText}>
                    • Must be different from current password
                  </Text>
                </View>

                {/* Change Password Button */}
                <TouchableOpacity
                  onPress={handleChangePassword}
                  disabled={isLoading}
                  style={[
                    appBottomSheetStyles.primaryCta,
                    styles.primaryButtonRow,
                    isLoading && styles.primaryButtonDisabled,
                  ]}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Feather name="lock" size={20} color="#FFFFFF" />
                      <Text style={appBottomSheetStyles.primaryCtaText}>
                        Change Password
                      </Text>
                    </>
                  )}
                </TouchableOpacity>

                {/* Cancel Button */}
                <TouchableOpacity
                  onPress={() => {
                    setErrors({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    setPasswords({
                      currentPassword: "",
                      newPassword: "",
                      confirmPassword: "",
                    });
                    onClose();
                  }}
                  disabled={isLoading}
                  style={styles.cancelButton}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
  },
  overlay: appModalBottomSheetStyles.overlay,
  bottomSheet: {
    ...appBottomSheetAppearance.backgroundStyle,
    paddingBottom: 0,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 4,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 32,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: appBottomSheetStyles.inputLabel,
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 14,
    paddingHorizontal: 16,
  },
  inputWrapperError: appBottomSheetStyles.inputError,
  errorText: appBottomSheetStyles.fieldError,
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  eyeButton: {
    padding: 8,
  },
  requirementsText: {
    fontSize: 12,
    color: "#1D4ED8",
    marginBottom: 4,
  },
  primaryButtonRow: {
    flexDirection: "row",
    marginBottom: 12,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  cancelButton: {
    backgroundColor: AUTH_COLORS.greenSoft,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  cancelButtonText: {
    color: AUTH_COLORS.textDark,
    fontSize: 16,
    fontWeight: "600",
  },
});
