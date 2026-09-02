import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { iosInputIconSize, iosPasswordToggleButtonStyle, withIosInputContainerStyle, withIosMultilineTextInputStyle, withIosOtpTextInputStyle, withIosStandalonePasswordTextInputStyle, withIosStandaloneTextInputStyle, withIosTextInputStyle } from "../../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../../components/AppTextInput";
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PickerField } from "../../../components/PickerField";
import AuthScreenLayout, {
  AuthProgressBar,
  RegistrationStepFooter,
} from "../../../components/AuthScreenLayout";
import { AuthTopBackButton } from "../../../components/AuthTopBackButton";
import { AUTH_COLORS, authScreenStyles } from "../../../lib/authScreenTheme";
import { namibianRegions, townsByRegion } from "../../../constants/locations";
import apiClient from "../../../lib/api";

// --- Type Definitions ---
type DocFile = ImagePicker.ImagePickerAsset | null;
type PdfFile = DocumentPicker.DocumentPickerAsset | null;

// --- Reusable UI Components ---
const UploadSquare = ({
  label,
  file,
  onPick,
  icon,
  isImage = false,
  hasError = false,
}: {
  label: string;
  file: DocFile | PdfFile;
  onPick: () => void;
  icon: any;
  isImage?: boolean;
  hasError?: boolean;
}) => (
  <TouchableOpacity
    onPress={onPick}
    className={`border border-dashed ${hasError ? "border-red-400" : "border-[#BBF7D0]"} rounded-xl items-center justify-center h-32 flex-1 overflow-hidden`}
    style={{ backgroundColor: "rgba(187, 247, 208, 0.35)" }}
  >
    {file ? (
      <>
        {isImage && (file as DocFile)?.uri ? (
          <Image
            source={{ uri: (file as DocFile)!.uri }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="items-center justify-center p-2 w-full h-full">
            <Feather name="check-circle" size={32} color={AUTH_COLORS.green} />
            <Text
              className="text-[#4B5563] font-semibold mt-2 text-center text-xs"
              numberOfLines={2}
            >
              {(file as any).name || (file as any).fileName || "File uploaded"}
            </Text>
          </View>
        )}
      </>
    ) : (
      <View className="items-center justify-center p-2 w-full h-full">
        <Feather name={icon} size={32} color={AUTH_COLORS.textMuted} />
        <Text className="text-[#14532D] font-semibold mt-2 text-center text-sm">
          {label}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

const ReviewRow = ({ label, value }: { label: string; value?: string }) => (
  <View className="mb-3">
    <Text className="text-sm text-[#4B5563]">{label}</Text>
    <Text className="text-base text-[#14532D] font-semibold">
      {value || "Not provided"}
    </Text>
  </View>
);

const ReviewFileRow = ({
  label,
  file,
}: {
  label: string;
  file: DocFile | PdfFile;
}) => (
  <View className="mb-3">
    <Text className="text-sm text-[#4B5563]">{label}</Text>
    <View className="flex-row items-center" style={{ gap: 6 }}>
      <Feather
        name={file ? "check-circle" : "x-circle"}
        size={16}
        color={file ? "#28A745" : "#EF4444"}
      />
      <Text className="text-base text-text-main font-semibold">
        {(file as any)?.fileName || (file as any)?.name || "Not attached"}
      </Text>
    </View>
  </View>
);

export default function RegistrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    confirmPassword: "",
    cellphoneNumber: "",
    dateOfBirth: new Date(),
    gender: "",
    address: "",
    town: "",
    region: "",
    nationalId: "",
    profileImage: null as DocFile,
    idDocumentFront: null as DocFile,
    idDocumentBack: null as DocFile,
  });

  const [step, setStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTowns, setAvailableTowns] = useState<
    { label: string; value: string }[]
  >([]);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);

  // Set up global callback for terms acceptance
  useEffect(() => {
    global.acceptTermsCallback = (accepted: boolean) => {
      setAcceptedTerms(accepted);
    };
    return () => {
      delete global.acceptTermsCallback;
    };
  }, []);

  useEffect(() => {
    if (params.cellphoneNumber && typeof params.cellphoneNumber === "string") {
      setFormData((prev) => ({
        ...prev,
        cellphoneNumber: params.cellphoneNumber as string,
      }));
    }
  }, [params.cellphoneNumber]);

  useEffect(() => {
    if (showDisclaimer) {
      const timer = setTimeout(() => {
        setShowDisclaimer(false);
      }, 30000); // 30 seconds

      return () => clearTimeout(timer);
    }
  }, [showDisclaimer]);

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field when user starts typing/selecting
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
    if (name === "region") {
      setAvailableTowns(townsByRegion[value] || []);
      setFormData((prev) => ({ ...prev, town: "" }));
    }
  };

  const pickImage = async (field: keyof typeof formData) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert(
        "Permission Denied",
        "We need camera roll permissions to select an image.",
      );
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      handleInputChange(field, result.assets[0]);
      // Clear error for this field when image is selected
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  const pickDocument = async (field: "idDocumentFront" | "idDocumentBack") => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert(
        "Permission Denied",
        "We need camera roll permissions to select an image.",
      );
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });
    if (!result.canceled) {
      handleInputChange(field, result.assets[0]);
      // Clear error for this field when document is selected
      if (errors[field]) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors[field];
          return newErrors;
        });
      }
    }
  };

  const onDateChange = (_: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.dateOfBirth;
    setShowDatePicker(false);
    handleInputChange("dateOfBirth", currentDate);
  };

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (
    password: string,
  ): { valid: boolean; message: string } => {
    if (password.length < 8)
      return {
        valid: false,
        message: "Password must be at least 8 characters long.",
      };
    if (!/[a-z]/.test(password))
      return {
        valid: false,
        message: "Password must contain at least one lowercase letter.",
      };
    if (!/[A-Z]/.test(password))
      return {
        valid: false,
        message: "Password must contain at least one uppercase letter.",
      };
    if (!/[0-9]/.test(password))
      return {
        valid: false,
        message: "Password must contain at least one number.",
      };
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password))
      return {
        valid: false,
        message: "Password must contain at least one special character.",
      };
    return { valid: true, message: "Password is strong." };
  };

  const handleNext = () => {
    const newErrors: { [key: string]: string } = {};

    if (step === 1) {
      if (!formData.fullname) newErrors.fullname = "Full name is required";
      if (!formData.email) newErrors.email = "Email is required";
      else if (!validateEmail(formData.email))
        newErrors.email = "Please enter a valid email address";
      if (!formData.password) newErrors.password = "Password is required";
      else {
        const passwordCheck = validatePassword(formData.password);
        if (!passwordCheck.valid) newErrors.password = passwordCheck.message;
      }
      if (!formData.confirmPassword)
        newErrors.confirmPassword = "Please confirm your password";
      else if (formData.password !== formData.confirmPassword)
        newErrors.confirmPassword = "Passwords do not match";
      if (!acceptedTerms)
        newErrors.terms =
          "You must read and accept the Terms and Conditions to continue";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    }
    if (step === 2) {
      if (!formData.gender) newErrors.gender = "Please select your gender";
      if (!formData.nationalId.trim())
        newErrors.nationalId = "National ID is required";
      else if (!/^\d{11}$/.test(formData.nationalId))
        newErrors.nationalId =
          "National ID must be exactly 11 numeric characters";
      if (!formData.idDocumentFront)
        newErrors.idDocumentFront = "Please upload the front of your ID";
      if (!formData.idDocumentBack)
        newErrors.idDocumentBack = "Please upload the back of your ID";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    }
    if (step === 3) {
      if (!formData.address) newErrors.address = "Address is required";
      if (!formData.region) newErrors.region = "Please select your region";
      if (!formData.town) newErrors.town = "Please select your town";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    }
    if (step === 4) {
      if (!formData.profileImage)
        newErrors.profileImage = "Please upload a profile picture";

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }
    }

    setErrors({});
    setStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setErrors({});
    setStep((prev) => prev - 1);
  };

  // In app/(auth)/registration.tsx

  const handleRegister = async () => {
    // Frontend validation remains the same
    if (!formData.profileImage)
      return Alert.alert(
        "Profile Image Required",
        "Please upload a profile picture.",
      );
    if (!formData.idDocumentFront)
      return Alert.alert(
        "ID Document Required",
        "Please upload the front of your ID.",
      );
    if (!formData.idDocumentBack)
      return Alert.alert(
        "ID Document Required",
        "Please upload the back of your ID.",
      );

    setIsLoading(true);

    const data = new FormData();

    // --- THIS IS THE CORRECTED LOGIC ---
    // We now loop through all formData properties and append them.
    (Object.keys(formData) as (keyof typeof formData)[]).forEach((key) => {
      if (key === "confirmPassword") return; // The only field to exclude

      const value = formData[key];

      if (value instanceof Date) {
        data.append(key, value.toISOString().split("T")[0]);
      }
      // Check if it's a file object (has a 'uri' property)
      else if (typeof value === "object" && value?.uri) {
        data.append(key, {
          uri: value.uri,
          name: (value as any).name || (value as any).fileName || `${key}.jpg`,
          type: (value as any).mimeType || (value as any).type || "image/jpeg",
        } as any);
      }
      // Append all other string/number values
      else if (value) {
        data.append(key, String(value));
      }
    });
    // ------------------------------------

    try {
      // We only need this single API call now
      const response = await apiClient.post(
        "/app/auth/register-patient",
        data,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      console.log("Registration response:", response.data);
      if (response.status === 201) {
        Alert.alert(
          "Registration Complete!",
          "Your account has been created successfully. Please sign in.",
          [{ text: "OK", onPress: () => router.replace("/(root)/sign-in") }],
        );
      } else {
        // Handle cases where the server might respond with a non-201 success code
        throw new Error(response.data.message || "An unknown error occurred.");
      }
    } catch (error: any) {
      console.error("Registration error:", error);
      const errorMessage =
        error?.response?.data?.message ||
        "An unexpected error occurred during registration.";
      Alert.alert("Registration Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <View style={styles.screen}>
        <AuthScreenLayout
          hideBrandHeader
          hideFooter
          extraScrollTopPadding={56}
          scrollBottomPadding={24}
          stickyFooter={
            <RegistrationStepFooter
              step={step}
              totalSteps={5}
              onBack={handleBack}
              onNext={handleNext}
              onSubmit={handleRegister}
              isLoading={isLoading}
              nextDisabled={step === 1 && !acceptedTerms}
              submitLabel="Register"
            />
          }
        >
        <AuthProgressBar step={step} totalSteps={5} />

          {step === 1 && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-[22px] font-bold text-[#14532D] mb-6">
                Account Information
              </Text>

              {showDisclaimer && (
                <View style={authScreenStyles.disclaimerBox}>
                  <View className="flex-row items-start">
                    <Feather
                      name="shield"
                      size={20}
                      color={AUTH_COLORS.green}
                      style={{ marginRight: 12, marginTop: 2 }}
                    />
                    <View className="flex-1">
                      <Text style={authScreenStyles.disclaimerTitle}>
                        Data Privacy Assurance
                      </Text>
                      <Text style={authScreenStyles.disclaimerBody}>
                        Your personal information is treated with the utmost
                        confidentiality. We do not share, sell, or distribute
                        your data to any third parties. Your privacy and data
                        security are our top priorities.
                      </Text>
                    </View>
                  </View>
                </View>
              )}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Full Name
              </Text>
              <TextInput
                style={withIosStandaloneTextInputStyle()}
                className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.fullname ? "border-red-400" : "border-[#BBF7D0]"}`}
                placeholder="Enter your full name"
                value={formData.fullname}
                onChangeText={(val) => handleInputChange("fullname", val)}
              />
              {errors.fullname && (
                <Text className="text-red-500 text-sm mb-3">
                  {errors.fullname}
                </Text>
              )}
              {!errors.fullname && <View className="mb-3" />}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Email
              </Text>
              <TextInput
                style={withIosStandaloneTextInputStyle()}
                className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.email ? "border-red-400" : "border-[#BBF7D0]"}`}
                placeholder="youremail@example.com"
                value={formData.email}
                onChangeText={(val) => handleInputChange("email", val)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              {errors.email && (
                <Text className="text-red-500 text-sm mb-3">
                  {errors.email}
                </Text>
              )}
              {!errors.email && <View className="mb-3" />}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Password
              </Text>
              <View className="relative mb-1">
                <TextInput
                  style={withIosStandalonePasswordTextInputStyle()}
                  className={`bg-white p-4 rounded-xl border-2 ${errors.password ? "border-red-400" : "border-[#BBF7D0]"}`}
                  placeholder="Create a strong password"
                  value={formData.password}
                  onChangeText={(val) => handleInputChange("password", val)}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={iosPasswordToggleButtonStyle}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showPassword ? "Hide password" : "Show password"
                  }
                >
                  <Feather
                    name={showPassword ? "eye" : "eye-off"}
                    size={iosInputIconSize}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text className="text-red-500 text-sm mb-3">
                  {errors.password}
                </Text>
              )}
              {!errors.password && <View className="mb-3" />}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Confirm Password
              </Text>
              <View className="relative mb-1">
                <TextInput
                  style={withIosStandalonePasswordTextInputStyle()}
                  className={`bg-white p-4 rounded-xl border-2 ${errors.confirmPassword ? "border-red-400" : "border-[#BBF7D0]"}`}
                  placeholder="Confirm your password"
                  value={formData.confirmPassword}
                  onChangeText={(val) =>
                    handleInputChange("confirmPassword", val)
                  }
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoComplete="password-new"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={iosPasswordToggleButtonStyle}
                  accessibilityRole="button"
                  accessibilityLabel={
                    showConfirmPassword ? "Hide password" : "Show password"
                  }
                >
                  <Feather
                    name={showConfirmPassword ? "eye" : "eye-off"}
                    size={iosInputIconSize}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text className="text-red-500 text-sm mb-3">
                  {errors.confirmPassword}
                </Text>
              )}
              {!errors.confirmPassword && <View className="mb-3" />}

              {/* Terms and Conditions Checkbox */}
              <TouchableOpacity
                onPress={() => {
                  if (acceptedTerms) {
                    setAcceptedTerms(false);
                  } else {
                    setShowTermsModal(true);
                  }
                  // Clear error when user interacts with terms
                  if (errors.terms) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.terms;
                      return newErrors;
                    });
                  }
                }}
                className={`flex-row items-start p-4 bg-gray-50 rounded-xl border-2 ${errors.terms ? "border-red-400" : "border-[#BBF7D0]"} mt-2`}
                activeOpacity={0.7}
              >
                <View
                  className={`w-6 h-6 rounded-md mr-3 items-center justify-center border-2 ${acceptedTerms ? "bg-[#16A34A] border-[#16A34A]" : "bg-white border-[#BBF7D0]"}`}
                >
                  {acceptedTerms && (
                    <Feather name="check" size={16} color="white" />
                  )}
                </View>
                <View className="flex-1">
                  <Text className="text-[#14532D] text-sm leading-5">
                    {acceptedTerms ? (
                      <Text className="text-green-600 font-semibold">
                        ✓ You have agreed to the Terms and Conditions and
                        Privacy Policy (Tap to revoke)
                      </Text>
                    ) : (
                      <Text>
                        Tap to read and agree to the{" "}
                        <Text className="text-green-600 font-semibold underline">
                          Terms and Conditions
                        </Text>{" "}
                        and{" "}
                        <Text className="text-green-600 font-semibold underline">
                          Privacy Policy
                        </Text>
                      </Text>
                    )}
                  </Text>
                </View>
              </TouchableOpacity>
              {errors.terms && (
                <Text className="text-red-500 text-sm mt-2">
                  {errors.terms}
                </Text>
              )}
            </ScrollView>
          )}

          {step === 2 && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-[22px] font-bold text-[#14532D] mb-6">
                Personal Information
              </Text>

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Mobile
              </Text>
              <View
                style={{ backgroundColor: "rgba(187, 247, 208, 0.35)" }}
                className="p-4 rounded-xl mb-4 border-2 border-[#BBF7D0]"
              >
                <Text className="text-base text-[#14532D]">
                  {formData.cellphoneNumber}
                </Text>
              </View>

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Date of Birth
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white p-4 rounded-xl mb-4 border-2 border-[#BBF7D0]"
              >
                <Text className="text-base text-[#14532D]">
                  {formData.dateOfBirth.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={formData.dateOfBirth}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Gender
              </Text>
              <View className="mb-1" style={{ gap: 12 }}>
                {["Male", "Female"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    className={`p-4 rounded-xl border-2 ${formData.gender === g ? "bg-[#16A34A] border-[#16A34A]" : errors.gender ? "bg-white border-red-400" : "bg-white border-[#BBF7D0]"}`}
                    onPress={() => handleInputChange("gender", g)}
                  >
                    <Text
                      className={`text-center font-semibold ${formData.gender === g ? "text-white" : "text-[#14532D]"}`}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {errors.gender && (
                <Text className="text-red-500 text-sm mb-3">
                  {errors.gender}
                </Text>
              )}
              {!errors.gender && <View className="mb-3" />}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                National ID Number
              </Text>
              <TextInput
                style={withIosStandaloneTextInputStyle()}
                className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.nationalId ? "border-red-400" : "border-[#BBF7D0]"}`}
                placeholder="Enter your 11-digit National ID"
                value={formData.nationalId}
                onChangeText={(val) => {
                  const numericOnly = val.replace(/[^0-9]/g, "");
                  if (numericOnly.length <= 11) {
                    handleInputChange("nationalId", numericOnly);
                  }
                }}
                keyboardType="numeric"
                maxLength={11}
              />
              {errors.nationalId && (
                <Text className="text-red-500 text-sm mb-3">
                  {errors.nationalId}
                </Text>
              )}
              {!errors.nationalId && <View className="mb-3" />}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                National ID Documents
              </Text>
              <View className="flex-row mb-1" style={{ gap: 16 }}>
                <View className="flex-1">
                  <UploadSquare
                    label="Upload ID (Front)"
                    file={formData.idDocumentFront}
                    onPick={() => pickDocument("idDocumentFront")}
                    icon="camera"
                    isImage={true}
                    hasError={!!errors.idDocumentFront}
                  />
                </View>
                <View className="flex-1">
                  <UploadSquare
                    label="Upload ID (Back)"
                    file={formData.idDocumentBack}
                    onPick={() => pickDocument("idDocumentBack")}
                    icon="camera"
                    isImage={true}
                    hasError={!!errors.idDocumentBack}
                  />
                </View>
              </View>
              {errors.idDocumentFront && (
                <Text className="text-red-500 text-sm mb-1">
                  {errors.idDocumentFront}
                </Text>
              )}
              {errors.idDocumentBack && (
                <Text className="text-red-500 text-sm mb-1">
                  {errors.idDocumentBack}
                </Text>
              )}
              <Text className="text-xs text-[#4B5563] mb-4">
                Upload clear photos of the front and back of your ID (JPG or
                PNG)
              </Text>
            </ScrollView>
          )}

          {step === 3 && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-[22px] font-bold text-[#14532D] mb-6">
                Address Information
              </Text>

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Address
              </Text>
              <TextInput
                style={withIosMultilineTextInputStyle()}
                className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.address ? "border-red-400" : "border-[#BBF7D0]"}`}
                placeholder="Your street address or P.O. Box"
                value={formData.address}
                onChangeText={(val) => handleInputChange("address", val)}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
              {errors.address && (
                <Text className="text-red-500 text-sm mb-3">
                  {errors.address}
                </Text>
              )}
              {!errors.address && <View className="mb-3" />}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Region
              </Text>

              <View className={errors.region ? "mb-1" : "mb-4"}>
                <PickerField
                  value={formData.region}
                  onValueChange={(value) => handleInputChange("region", value)}
                  items={namibianRegions}
                  placeholder="Select a region..."
                  error={!!errors.region}
                  borderColor="#D1D5DB"
                />
              </View>
              {errors.region && (
                <Text className="text-red-500 text-sm mb-2">
                  {errors.region}
                </Text>
              )}

              <Text className="text-[15px] text-[#14532D] mb-2 font-semibold ml-1">
                Town
              </Text>

              <View className={errors.town ? "mb-1" : "mb-4"}>
                <PickerField
                  value={formData.town}
                  onValueChange={(value) => handleInputChange("town", value)}
                  items={availableTowns}
                  placeholder="Select a town..."
                  disabled={!formData.region}
                  error={!!errors.town}
                  borderColor="#D1D5DB"
                />
              </View>
              {errors.town && (
                <Text className="text-red-500 text-sm mb-2">{errors.town}</Text>
              )}
            </ScrollView>
          )}

          {step === 4 && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text className="text-[22px] font-bold text-[#14532D] mb-6">
                Profile Picture
              </Text>

              <View className="items-center mb-1">
                <TouchableOpacity
                  onPress={() => pickImage("profileImage")}
                  className={`w-40 h-40 rounded-full bg-gray-100 border-2 ${errors.profileImage ? "border-red-400" : "border-[#BBF7D0]"} justify-center items-center overflow-hidden`}
                  activeOpacity={0.7}
                >
                  {formData.profileImage ? (
                    <Image
                      source={{ uri: formData.profileImage.uri }}
                      className="w-full h-full"
                    />
                  ) : (
                    <View className="items-center">
                      <Feather name="camera" size={32} color="#6B7280" />
                      <Text className="text-[#4B5563] text-sm mt-2 font-semibold">
                        Tap to upload
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
              {errors.profileImage && (
                <Text className="text-red-500 text-sm mb-3 text-center">
                  {errors.profileImage}
                </Text>
              )}
              {!errors.profileImage && <View className="mb-3" />}
            </ScrollView>
          )}
          {/* --- STEP 5: Review & Submit --- */}
          {step === 5 && (
            <ScrollView
              style={{ flex: 1 }}
              contentContainerStyle={{ paddingBottom: 150 }}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <View className="items-center mb-6">
                <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center mb-4">
                  <Feather name="check" size={36} color="#2563EB" />
                </View>
                <Text className="text-[22px] font-bold text-[#14532D] mb-2">
                  Review & Submit
                </Text>
                <Text className="text-base text-[#4B5563] text-center px-4">
                  Review your information before submitting
                </Text>
              </View>

              <View className="w-full bg-white p-5 rounded-xl border-2 border-[#BBF7D0] mb-6">
                {/* Account Info Review */}
                <View>
                  <Text className="text-lg font-bold text-[#14532D] mb-3">
                    Account
                  </Text>
                  <ReviewRow label="Full Name" value={formData.fullname} />
                  <ReviewRow label="Email" value={formData.email} />
                </View>
                <View className="h-px bg-gray-200" />

                {/* Personal Info Review */}
                <View>
                  <Text className="text-lg font-bold text-[#14532D] mb-3">
                    Personal
                  </Text>
                  <ReviewRow label="Mobile" value={formData.cellphoneNumber} />
                  <ReviewRow
                    label="Date of Birth"
                    value={formData.dateOfBirth.toLocaleDateString()}
                  />
                  <ReviewRow label="Gender" value={formData.gender} />
                  <ReviewRow label="National ID" value={formData.nationalId} />
                </View>
                <View className="h-px bg-gray-200" />

                {/* Address Review */}
                <View>
                  <Text className="text-lg font-bold text-[#14532D] mb-3">
                    Address
                  </Text>
                  <ReviewRow label="Region" value={formData.region} />
                  <ReviewRow label="Town" value={formData.town} />
                  <ReviewRow label="Street Address" value={formData.address} />
                </View>
                <View className="h-px bg-gray-200" />

                {/* Documents & Profile Image Review */}
                <View>
                  <Text className="text-lg font-bold text-[#14532D] mb-3">
                    Documents & Photo
                  </Text>

                  {/* Profile Picture Preview */}
                  <View className="mb-4">
                    <Text className="text-sm text-[#4B5563] mb-2">
                      Profile Picture
                    </Text>
                    {formData.profileImage ? (
                      <View className="items-center">
                        <Image
                          source={{ uri: formData.profileImage.uri }}
                          className="w-32 h-32 rounded-full border-2 border-[#BBF7D0]"
                        />
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <Feather name="x-circle" size={16} color="#EF4444" />
                        <Text className="text-base text-[#14532D] font-semibold ml-2">
                          Not uploaded
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* ID Documents Preview */}
                  <View className="mb-4">
                    <Text className="text-sm text-[#4B5563] mb-2">
                      National ID (Front)
                    </Text>
                    {formData.idDocumentFront ? (
                      <View className="items-center">
                        <Image
                          source={{ uri: formData.idDocumentFront.uri }}
                          className="w-full h-48 rounded-xl border-2 border-[#BBF7D0]"
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <Feather name="x-circle" size={16} color="#EF4444" />
                        <Text className="text-base text-[#14532D] font-semibold ml-2">
                          Not uploaded
                        </Text>
                      </View>
                    )}
                  </View>

                  <View className="mb-3">
                    <Text className="text-sm text-[#4B5563] mb-2">
                      National ID (Back)
                    </Text>
                    {formData.idDocumentBack ? (
                      <View className="items-center">
                        <Image
                          source={{ uri: formData.idDocumentBack.uri }}
                          className="w-full h-48 rounded-xl border-2 border-[#BBF7D0]"
                          resizeMode="contain"
                        />
                      </View>
                    ) : (
                      <View className="flex-row items-center">
                        <Feather name="x-circle" size={16} color="#EF4444" />
                        <Text className="text-base text-[#14532D] font-semibold ml-2">
                          Not uploaded
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </ScrollView>
          )}
        </AuthScreenLayout>

        <AuthTopBackButton
          onPress={() => (step > 1 ? handleBack() : router.back())}
        />
      </View>

      {/* Terms and Conditions Modal */}
      <Modal
        visible={showTermsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowTermsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: AUTH_COLORS.bg }}>
          <View style={{ flex: 1, backgroundColor: AUTH_COLORS.bg }}>
            {/* Header */}
            <View
              className="flex-row items-center justify-between p-6 border-b-2"
              style={{ borderBottomColor: AUTH_COLORS.inputBorder }}
            >
              <Text className="text-2xl font-bold text-[#14532D] flex-1">
                Terms & Conditions
              </Text>
              <TouchableOpacity
                onPress={() => setShowTermsModal(false)}
                className="p-2"
              >
                <Feather name="x" size={24} color="#374151" />
              </TouchableOpacity>
            </View>

            {/* Content */}
            <ScrollView className="flex-1 p-6">
              <Text className="text-lg font-bold text-red-600 mb-4">
                Absolute Patient Waiver and Release of Liability
              </Text>
              <Text className="text-sm text-[#14532D] mb-4 leading-6">
                By clicking &quot;Accept&quot; and using the Health_Connect
                platform, you (the &quot;User&quot;) confirm and irrevocably
                agree to the following legally binding terms. Your acceptance
                constitutes a complete and absolute waiver of your right to sue
                the platform.
              </Text>

              <Text className="text-base font-bold text-[#14532D] mb-3">
                Technology Platform Status (Not a Healthcare Provider)
              </Text>
              <Text className="text-sm text-[#14532D] mb-4 leading-6">
                You acknowledge and agree that Kopano-Vertex Trading cc (trading
                as Health_Connect) is exclusively a technology service provider.
                The platform provides a logistical connection between you and
                independent healthcare practitioners. Under no circumstances is
                Health_Connect, its owners, directors, or employees a provider
                of medical care, diagnosis, advice, or treatment.
              </Text>

              <Text className="text-base font-bold text-[#14532D] mb-3">
                Absolute Assumption of Risk and Release of Claims
              </Text>
              <Text className="text-sm text-[#14532D] mb-4 leading-6">
                You understand and agree that the entire responsibility and
                liability for the clinical services, advice, and outcomes rests
                solely and exclusively with the independent healthcare provider
                you select.
              </Text>

              <Text className="text-base font-bold text-[#14532D] mb-3">
                Irrevocable Waiver
              </Text>
              <Text className="text-sm text-[#14532D] mb-4 leading-6">
                You hereby irrevocably and absolutely release, waive, and
                forever discharge Kopano-Vertex Trading cc, its affiliates,
                directors, owners, and employees from any and all claims,
                demands, liabilities, suits, actions, and causes of action
                whatsoever, whether in law or equity, which may arise from or
                relate to the medical care, advice, diagnosis, treatment, or
                judgment provided by any independent healthcare professional
                connected through the platform.
              </Text>

              <Text className="text-base font-bold text-[#14532D] mb-3">
                No Recourse Against Platform
              </Text>
              <Text className="text-sm text-[#14532D] mb-4 leading-6">
                You acknowledge that your sole and exclusive recourse for any
                claim of malpractice, negligence, misdiagnosis, or professional
                error is directly against the independent healthcare provider
                and not against Health_Connect.
              </Text>

              <Text className="text-base font-bold text-[#14532D] mb-3">
                Independent Contractor Status of Providers
              </Text>
              <Text className="text-sm text-[#14532D] mb-4 leading-6">
                You acknowledge and agree that the healthcare practitioners on
                this platform are independent contractors and are not employees,
                agents, partners, or representatives of Health_Connect.
              </Text>

              <Text className="text-base font-bold text-[#14532D] mb-3">
                Emergency Services Exclusion
              </Text>
              <Text className="text-sm text-[#14532D] mb-6 leading-6">
                You understand that this platform is NOT a substitute for
                emergency medical care. You warrant that you will not use this
                platform for any medical emergency, and you accept full
                liability for any harm resulting from attempting to use this
                service in an emergency.
              </Text>
            </ScrollView>

            {/* Footer with Accept Button */}
            <View
              className="p-6 border-t-2 border-[#BBF7D0]"
              style={{ backgroundColor: AUTH_COLORS.bg }}
            >
              <TouchableOpacity
                onPress={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }}
                style={{ backgroundColor: AUTH_COLORS.green }}
                className="p-4 rounded-xl"
              >
                <Text className="text-white text-center text-lg font-bold">
                  I Accept
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
});
