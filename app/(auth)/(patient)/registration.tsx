import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { iosPasswordToggleButtonStyle, withIosMultilineTextInputStyle, withIosStandalonePasswordTextInputStyle, withIosStandaloneTextInputStyle } from "../../../lib/iosInputStyles";
import { AppTextInput as TextInput } from "../../../components/AppTextInput";
import { Alert, Image, Modal, Platform, StyleProp, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { PickerField } from "../../../components/PickerField";
import RegistrationFeatureShell, {
  ProfileSectionRail,
  RegistrationStepActions,
  profileFeatureStyles,
} from "../../../components/RegistrationFeatureShell";
import TermsConditionsModal from "../../../components/TermsConditionsModal";
import { AUTH_COLORS, authScreenStyles } from "../../../lib/authScreenTheme";
import { namibianRegions, townsByRegion } from "../../../constants/locations";
import apiClient from "../../../lib/api";

const PATIENT_STEP_META = [
  {
    title: "Account",
    subtitle: "Create your Health Connect login credentials.",
  },
  {
    title: "Personal details",
    subtitle: "Tell us about yourself so we can personalize care.",
  },
  {
    title: "Address",
    subtitle: "Where can we find you when care is needed?",
  },
  {
    title: "Profile photo",
    subtitle: "Add a clear photo so providers can recognize you.",
  },
  {
    title: "Review",
    subtitle: "Confirm your details before finishing registration.",
  },
] as const;

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
  const iosDateBeforeEdit = useRef<Date | null>(null);
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

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (event?.type === "dismissed") return;
    if (selectedDate) {
      handleInputChange("dateOfBirth", selectedDate);
    }
  };

  const openDatePicker = () => {
    iosDateBeforeEdit.current = formData.dateOfBirth;
    setShowDatePicker(true);
  };

  const confirmIosDate = () => setShowDatePicker(false);

  const cancelIosDate = () => {
    if (iosDateBeforeEdit.current) {
      handleInputChange("dateOfBirth", iosDateBeforeEdit.current);
    }
    setShowDatePicker(false);
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

  const stepMeta = PATIENT_STEP_META[step - 1] ?? PATIENT_STEP_META[0];

  return (
    <>
      <RegistrationFeatureShell
        step={step}
        totalSteps={5}
        title={stepMeta.title}
        subtitle={stepMeta.subtitle}
        onBack={() => (step > 1 ? handleBack() : router.back())}
        footer={
          <RegistrationStepActions
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
          {step === 1 && (
            <View>
              <ProfileSectionRail title="Account information" />

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

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Full name</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle([
                    profileFeatureStyles.input,
                    errors.fullname ? regStyles.inputError : undefined,
                  ])}
                  placeholder="Enter your full name"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.fullname}
                  onChangeText={(val) => handleInputChange("fullname", val)}
                />
                {errors.fullname ? (
                  <Text style={regStyles.errorText}>{errors.fullname}</Text>
                ) : null}
              </View>

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Email</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle([
                    profileFeatureStyles.input,
                    errors.email ? regStyles.inputError : undefined,
                  ])}
                  placeholder="youremail@example.com"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.email}
                  onChangeText={(val) => handleInputChange("email", val)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email ? (
                  <Text style={regStyles.errorText}>{errors.email}</Text>
                ) : null}
              </View>

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Password</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={withIosStandalonePasswordTextInputStyle([
                      profileFeatureStyles.input,
                      errors.password ? regStyles.inputError : undefined,
                    ])}
                    placeholder="Create a strong password"
                    placeholderTextColor={AUTH_COLORS.placeholder}
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
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? (
                  <Text style={regStyles.errorText}>{errors.password}</Text>
                ) : null}
              </View>

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Confirm password</Text>
                <View style={{ position: "relative" }}>
                  <TextInput
                    style={withIosStandalonePasswordTextInputStyle([
                      profileFeatureStyles.input,
                      errors.confirmPassword ? regStyles.inputError : undefined,
                    ])}
                    placeholder="Confirm your password"
                    placeholderTextColor={AUTH_COLORS.placeholder}
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
                      size={20}
                      color="#6B7280"
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword ? (
                  <Text style={regStyles.errorText}>
                    {errors.confirmPassword}
                  </Text>
                ) : null}
              </View>

              {/* Terms and Conditions Checkbox */}
              <TouchableOpacity
                onPress={() => {
                  if (acceptedTerms) {
                    setAcceptedTerms(false);
                  } else {
                    setShowTermsModal(true);
                  }
                  if (errors.terms) {
                    setErrors((prev) => {
                      const newErrors = { ...prev };
                      delete newErrors.terms;
                      return newErrors;
                    });
                  }
                }}
                style={[
                  regStyles.termsBox,
                  errors.terms ? regStyles.termsBoxError : null,
                ]}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    regStyles.checkbox,
                    acceptedTerms ? regStyles.checkboxChecked : null,
                  ]}
                >
                  {acceptedTerms ? (
                    <Feather name="check" size={16} color="white" />
                  ) : null}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={regStyles.termsText}>
                    {acceptedTerms
                      ? "You have agreed to the Terms and Conditions and Privacy Policy (tap to revoke)"
                      : "Tap to read and agree to the Terms and Conditions and Privacy Policy"}
                  </Text>
                </View>
              </TouchableOpacity>
              {errors.terms ? (
                <Text style={regStyles.errorText}>{errors.terms}</Text>
              ) : null}
            </View>
          )}

          {step === 2 && (
            <View>
              <ProfileSectionRail title="Personal information" />

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Mobile</Text>
                <Text style={regStyles.readOnlyValue}>
                  {formData.cellphoneNumber || "Not provided"}
                </Text>
              </View>

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Date of birth</Text>
                <TouchableOpacity
                  onPress={openDatePicker}
                  style={
                    withIosStandaloneTextInputStyle([
                      profileFeatureStyles.input,
                      errors.dateOfBirth ? regStyles.inputError : undefined,
                    ]) as StyleProp<ViewStyle>
                  }
                  activeOpacity={0.7}
                >
                  <Text style={regStyles.dateText}>
                    {formData.dateOfBirth.toLocaleDateString()}
                  </Text>
                </TouchableOpacity>
                {errors.dateOfBirth ? (
                  <Text style={regStyles.errorText}>{errors.dateOfBirth}</Text>
                ) : null}
                {showDatePicker && Platform.OS === "android" ? (
                  <DateTimePicker
                    value={formData.dateOfBirth}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    maximumDate={new Date()}
                  />
                ) : null}
              </View>

              {showDatePicker && Platform.OS === "ios" ? (
                <Modal
                  transparent
                  animationType="slide"
                  visible={showDatePicker}
                  onRequestClose={cancelIosDate}
                >
                  <View style={regStyles.iosPickerOverlay}>
                    <TouchableOpacity
                      style={regStyles.iosPickerBackdrop}
                      activeOpacity={1}
                      onPress={cancelIosDate}
                    />
                    <View style={regStyles.iosPickerSheet}>
                      <View style={regStyles.iosPickerToolbar}>
                        <TouchableOpacity onPress={cancelIosDate} hitSlop={12}>
                          <Text style={regStyles.iosPickerCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={regStyles.iosPickerTitle}>
                          Date of birth
                        </Text>
                        <TouchableOpacity onPress={confirmIosDate} hitSlop={12}>
                          <Text style={regStyles.iosPickerDone}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={formData.dateOfBirth}
                        mode="date"
                        display="spinner"
                        themeVariant="light"
                        onChange={onDateChange}
                        maximumDate={new Date()}
                        style={regStyles.iosPicker}
                      />
                    </View>
                  </View>
                </Modal>
              ) : null}

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Gender</Text>
                <View style={regStyles.segment}>
                  {["Male", "Female"].map((g) => (
                    <TouchableOpacity
                      key={g}
                      onPress={() => handleInputChange("gender", g)}
                      style={[
                        regStyles.segmentItem,
                        formData.gender === g && regStyles.segmentItemActive,
                      ]}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          regStyles.segmentText,
                          formData.gender === g && regStyles.segmentTextActive,
                        ]}
                      >
                        {g}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {errors.gender ? (
                  <Text style={regStyles.errorText}>{errors.gender}</Text>
                ) : null}
              </View>

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>National ID number</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle([
                    profileFeatureStyles.input,
                    errors.nationalId ? regStyles.inputError : undefined,
                  ])}
                  placeholder="Enter your 11-digit National ID"
                  placeholderTextColor={AUTH_COLORS.placeholder}
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
                {errors.nationalId ? (
                  <Text style={regStyles.errorText}>{errors.nationalId}</Text>
                ) : null}
              </View>

              <View
                style={[
                  profileFeatureStyles.fieldBlock,
                  profileFeatureStyles.fieldBlockLast,
                ]}
              >
                <Text style={profileFeatureStyles.label}>
                  National ID documents
                </Text>
                <View className="flex-row" style={{ gap: 16 }}>
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
                {errors.idDocumentFront ? (
                  <Text style={regStyles.errorText}>
                    {errors.idDocumentFront}
                  </Text>
                ) : null}
                {errors.idDocumentBack ? (
                  <Text style={regStyles.errorText}>
                    {errors.idDocumentBack}
                  </Text>
                ) : null}
                <Text style={regStyles.hintText}>
                  Upload clear photos of the front and back of your ID (JPG or
                  PNG)
                </Text>
              </View>
            </View>
          )}

          {step === 3 && (
            <View>
              <ProfileSectionRail title="Where you live" />

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Address</Text>
                <TextInput
                  style={withIosMultilineTextInputStyle([
                    profileFeatureStyles.input,
                    errors.address ? regStyles.inputError : undefined,
                  ])}
                  placeholder="Your street address or P.O. Box"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.address}
                  onChangeText={(val) => handleInputChange("address", val)}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                {errors.address ? (
                  <Text style={regStyles.errorText}>{errors.address}</Text>
                ) : null}
              </View>

              <View style={profileFeatureStyles.fieldBlock}>
                <Text style={profileFeatureStyles.label}>Region</Text>
                <PickerField
                  value={formData.region}
                  onValueChange={(value) => handleInputChange("region", value)}
                  items={namibianRegions}
                  placeholder="Select a region..."
                  error={!!errors.region}
                />
                {errors.region ? (
                  <Text style={regStyles.errorText}>{errors.region}</Text>
                ) : null}
              </View>

              <View
                style={[
                  profileFeatureStyles.fieldBlock,
                  profileFeatureStyles.fieldBlockLast,
                ]}
              >
                <Text style={profileFeatureStyles.label}>Town</Text>
                <PickerField
                  value={formData.town}
                  onValueChange={(value) => handleInputChange("town", value)}
                  items={availableTowns}
                  placeholder="Select a town..."
                  disabled={!formData.region}
                  error={!!errors.town}
                />
                {errors.town ? (
                  <Text style={regStyles.errorText}>{errors.town}</Text>
                ) : null}
              </View>
            </View>
          )}

          {step === 4 && (
            <View>
              <ProfileSectionRail title="Profile picture" />

              <View
                style={[
                  profileFeatureStyles.fieldBlock,
                  profileFeatureStyles.fieldBlockLast,
                  { alignItems: "center" },
                ]}
              >
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
                {errors.profileImage ? (
                  <Text style={[regStyles.errorText, { textAlign: "center" }]}>
                    {errors.profileImage}
                  </Text>
                ) : null}
              </View>
            </View>
          )}

          {/* --- STEP 5: Review & Submit --- */}
          {step === 5 && (
            <View>
              <ProfileSectionRail title="Review & submit" />

              <View className="w-full bg-white p-5 rounded-xl border-2 border-[#BBF7D0] mb-2">
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
            </View>
          )}
      </RegistrationFeatureShell>

      <TermsConditionsModal
        visible={showTermsModal}
        audience="patient"
        onClose={() => setShowTermsModal(false)}
        onAccept={() => {
          setAcceptedTerms(true);
          setShowTermsModal(false);
        }}
      />
    </>
  );
}

const regStyles = StyleSheet.create({
  inputError: {
    borderColor: "#EF4444",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginTop: 4,
  },
  hintText: {
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    marginTop: 10,
  },
  readOnlyValue: {
    fontSize: 16,
    color: AUTH_COLORS.textDark,
    paddingVertical: 8,
  },
  dateText: {
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  termsBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    marginTop: 4,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  termsBoxError: {
    borderColor: "#EF4444",
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxChecked: {
    backgroundColor: AUTH_COLORS.green,
    borderColor: AUTH_COLORS.green,
  },
  termsText: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textDark,
  },
  segment: {
    flexDirection: "row",
    backgroundColor: AUTH_COLORS.greenSoft,
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  segmentItemActive: {
    backgroundColor: AUTH_COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  segmentTextActive: {
    color: AUTH_COLORS.textDark,
    fontWeight: "700",
  },
  iosPickerOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iosPickerBackdrop: {
    flex: 1,
  },
  iosPickerSheet: {
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 24,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderBottomWidth: 0,
  },
  iosPickerToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: AUTH_COLORS.inputBorder,
  },
  iosPickerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
  },
  iosPickerCancel: {
    fontSize: 16,
    color: AUTH_COLORS.textMuted,
    fontWeight: "600",
  },
  iosPickerDone: {
    fontSize: 16,
    color: AUTH_COLORS.green,
    fontWeight: "700",
  },
  iosPicker: {
    height: 216,
    alignSelf: "stretch",
  },
});
