import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  withIosInputContainerStyle,
  withIosTextInputStyle,
} from "../lib/iosInputStyles";
import { AppTextInput as TextInput } from "./AppTextInput";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import apiClient from "../lib/api";
import {
  ProfileFeatureShell,
  ProfileSectionRail,
  profileFeatureStyles,
} from "./ProfileFeatureShell";

interface ChangePasswordModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({
  visible,
  onClose,
}: ChangePasswordModalProps) {
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

  const resetAndClose = () => {
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
  };

  const handleChangePassword = async () => {
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

  const renderPasswordField = (
    key: "currentPassword" | "newPassword" | "confirmPassword",
    label: string,
    placeholder: string,
    last?: boolean,
  ) => (
    <View
      style={[
        profileFeatureStyles.fieldBlock,
        last && profileFeatureStyles.fieldBlockLast,
      ]}
    >
      <Text style={profileFeatureStyles.label}>{label}</Text>
      <View
        style={withIosInputContainerStyle([
          styles.inputWrapper,
          errors[key] ? styles.inputWrapperError : undefined,
        ])}
      >
        <TextInput
          style={withIosTextInputStyle(styles.input)}
          placeholder={placeholder}
          placeholderTextColor={AUTH_COLORS.placeholder}
          secureTextEntry={!showPasswords[key]}
          value={passwords[key]}
          onChangeText={(text) => {
            setPasswords({ ...passwords, [key]: text });
            if (errors[key]) {
              setErrors({ ...errors, [key]: "" });
            }
          }}
          editable={!isLoading}
        />
        <TouchableOpacity
          onPress={() =>
            setShowPasswords({
              ...showPasswords,
              [key]: !showPasswords[key],
            })
          }
          style={styles.eyeButton}
          activeOpacity={0.7}
        >
          <Feather
            name={showPasswords[key] ? "eye" : "eye-off"}
            size={20}
            color={errors[key] ? "#EF4444" : AUTH_COLORS.textMuted}
          />
        </TouchableOpacity>
      </View>
      {errors[key] ? <Text style={styles.errorText}>{errors[key]}</Text> : null}
    </View>
  );

  return (
    <ProfileFeatureShell
      visible={visible}
      onClose={resetAndClose}
      kicker="Account security"
      title="Change password"
      subtitle="Choose a strong password you haven’t used here before."
      keyboard
      footer={
        <>
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={isLoading}
            style={[
              profileFeatureStyles.primaryButton,
              isLoading && styles.disabled,
            ]}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="lock" size={18} color="#FFFFFF" />
                <Text style={profileFeatureStyles.primaryButtonText}>
                  Change password
                </Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={resetAndClose}
            disabled={isLoading}
            style={profileFeatureStyles.secondaryButton}
            activeOpacity={0.7}
          >
            <Text style={profileFeatureStyles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </>
      }
    >
      <ProfileSectionRail title="Password" />
      {renderPasswordField(
        "currentPassword",
        "Current password",
        "Enter current password",
      )}
      {renderPasswordField(
        "newPassword",
        "New password",
        "Enter new password",
      )}
      {renderPasswordField(
        "confirmPassword",
        "Confirm password",
        "Confirm new password",
        true,
      )}

      <View style={styles.notice}>
        <Text style={styles.noticeTitle}>Password requirements</Text>
        <Text style={styles.noticeText}>• At least 8 characters long</Text>
        <Text style={styles.noticeText}>
          • Must be different from current password
        </Text>
      </View>
    </ProfileFeatureShell>
  );
}

const styles = StyleSheet.create({
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 0,
    paddingHorizontal: 0,
  },
  inputWrapperError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 6,
  },
  input: {
    flex: 1,
    paddingVertical: 10,
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  eyeButton: {
    padding: 8,
  },
  notice: {
    marginTop: 8,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 6,
  },
  noticeText: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    marginBottom: 2,
  },
  disabled: {
    opacity: 0.6,
  },
});
