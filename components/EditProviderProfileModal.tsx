import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import { iosInputIconSize, withIosInputContainerStyle, withIosMultilineTextInputStyle, withIosOtpTextInputStyle, withIosStandaloneTextInputStyle, withIosTextInputStyle } from "../lib/iosInputStyles";
import { AppTextInput as TextInput } from "./AppTextInput";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KEYBOARD_VERTICAL_OFFSET } from "./ScreenLayout";
import { PickerField } from "./PickerField";
import { namibianRegions } from "../constants/locations";
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";
import { AUTH_COLORS } from "../lib/authScreenTheme";

interface EditProviderProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

interface Specialization {
  _id: string;
  title: string;
  role: string;
  description?: string;
}

// ── Validation helpers ────────────────────────────────────────────────────────

/** Strip spaces, dashes, and parentheses then validate Namibian mobile format.
 *  Accepts: 0XXXXXXXX (10 digits), +264XXXXXXXX (12 chars) or 264XXXXXXXX */
/** Strip formatting and validate. Returns null if valid. */
function validatePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().+]/g, "");
  if (!cleaned) return "Cellphone number is required";
  // Normalise to local 0XXXXXXXXX for validation check
  const local = cleaned.startsWith("264") && cleaned.length === 12
    ? "0" + cleaned.slice(3)
    : cleaned;
  if (!/^081\d{7}$/.test(local))
    return "Enter a valid Namibian mobile number (e.g. 0811234567 — 10 digits starting with 081)";
  return null;
}

/**
 * Backend expects exactly 12 digits starting with 26481 — no +, no leading 0.
 * e.g. 0817001001 → 264817001001
 */
function toBackendPhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().+]/g, "");
  if (cleaned.startsWith("264")) return cleaned;   // already 264XXXXXXXXX
  if (cleaned.startsWith("0")) return "264" + cleaned.slice(1); // 0XXXXXXXXX → 264XXXXXXXXX
  return cleaned;
}

function validateEmail(v: string): string | null {
  if (!v.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
    return "Enter a valid email address (e.g. name@example.com)";
  return null;
}

function validateYears(v: string): string | null {
  if (!v.trim()) return "Years of experience is required";
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 0 || n > 60)
    return "Enter a number between 0 and 60";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────

export default function EditProviderProfileModal({
  visible,
  onClose,
}: EditProviderProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showDatePicker, setShowDatePicker] = useState(false);
  const isDateInitialized = useRef(false);
  const isFormDataInitialized = useRef(false);
  const datePickerKey = useRef("date-picker-1");
  const lastSelectedDate = useRef<Date | null>(null);
  const iosDateBeforeEdit = useRef<Date | null>(null);

  // Specializations from API
  const [allSpecializations, setAllSpecializations] = useState<
    Specialization[]
  >([]);
  const [filteredSpecializations, setFilteredSpecializations] = useState<
    Specialization[]
  >([]);
  const [loadingSpecializations, setLoadingSpecializations] = useState(true);

  const [formData, setFormData] = useState({
    fullname: user?.fullname || "",
    email: user?.email || "",
    cellphoneNumber: user?.cellphoneNumber || "",
    gender: user?.gender || "Male",
    address: user?.address || "",
    hpcnaNumber: user?.hpcnaNumber || "",
    hpcnaExpiryDate: user?.hpcnaExpiryDate || "",
    specializations: user?.specializations || [],
    yearsOfExperience: user?.yearsOfExperience?.toString() || "",
    operationalZone: user?.operationalZone || "",
    governingCouncil:
      user?.governingCouncil || "Health Professionals Council of Namibia",
    bio: user?.bio || "",
    // ── Pharmacist-specific ────────────────────────────────────────────────
    registeredTradingName: (user as any)?.registeredTradingName || "",
    companyRegistrationNo: (user as any)?.companyRegistrationNo || "",
    businessEmail: (user as any)?.businessEmail || "",
    pharmacyCouncilNo: (user as any)?.pharmacyCouncilNo || "",
    practiceNumber: (user as any)?.practiceNumber || "",
    gpsLongitude: (user as any)?.gpsCoordinates?.longitude?.toString() || "",
    gpsLatitude: (user as any)?.gpsCoordinates?.latitude?.toString() || "",
    settlementCellNumber: (user as any)?.settlementCellNumber || "",
    hpcnaLicenseExpiryAcknowledged: (user as any)?.hpcnaLicenseExpiryAcknowledged || false,
  });

  const [expirationDate, setExpirationDate] = useState<Date>(() => {
    const initialDate = user?.hpcnaExpiryDate ? new Date(user.hpcnaExpiryDate) : new Date();
    console.log("📅 Initial expiration date set:", initialDate.toISOString());
    return initialDate;
  });

  // Fetch specializations from API
  useEffect(() => {
    const fetchSpecializations = async () => {
      try {
        setLoadingSpecializations(true);
        const response = await apiClient.get(
          "/app/specialization/all-specializations",
        );
        const list = response?.data?.specializations;
        if (Array.isArray(list)) {
          setAllSpecializations(list as Specialization[]);
        } else {
          setAllSpecializations([]);
        }
      } catch (error) {
        console.error("Error fetching specializations:", error);
        setAllSpecializations([]);
      } finally {
        setLoadingSpecializations(false);
      }
    };

    if (visible) {
      fetchSpecializations();
    }
  }, [visible]);

  // Filter specializations based on user role
  useEffect(() => {
    if (!allSpecializations.length || !user?.role) {
      setFilteredSpecializations([]);
      return;
    }

    const userRole = user.role.toLowerCase();
    const filtered = allSpecializations.filter(
      (spec) =>
        typeof spec.role === "string" && spec.role.toLowerCase() === userRole,
    );

    setFilteredSpecializations(filtered);
  }, [allSpecializations, user?.role]);

  // Track showDatePicker changes
  useEffect(() => {
    console.log("📅 showDatePicker changed:", showDatePicker);
  }, [showDatePicker]);

  // Track expirationDate changes
  useEffect(() => {
    console.log("📅 ExpirationDate state changed:", expirationDate.toISOString());
    console.log("📅 Stack trace:", new Error().stack);
  }, [expirationDate]);

  // Initialize form data when modal opens
  useEffect(() => {
    console.log("📋 Form data useEffect triggered:", {
      visible,
      user: !!user,
      isFormDataInitialized: isFormDataInitialized.current,
    });

    if (visible && user && !isFormDataInitialized.current) {
      console.log("📋 Setting form data for the first time");
      setFormData({
        fullname: user.fullname || "",
        email: user.email || "",
        cellphoneNumber: user.cellphoneNumber || "",
        gender: user.gender || "Male",
        address: user.address || "",
        hpcnaNumber: user.hpcnaNumber || "",
        hpcnaExpiryDate: user.hpcnaExpiryDate || "",
        specializations: user.specializations || [],
        yearsOfExperience: user.yearsOfExperience?.toString() || "",
        operationalZone: user.operationalZone || "",
        governingCouncil:
          user.governingCouncil || "Health Professionals Council of Namibia",
        bio: user.bio || "",
      });
      isFormDataInitialized.current = true;
    } else if (!visible) {
      console.log("📋 Resetting form data initialization flag");
      isFormDataInitialized.current = false;
    }
  }, [visible]);

  // Initialize expiration date only when modal first opens
  useEffect(() => {
    console.log("📅 Expiration date useEffect triggered:", {
      visible,
      isDateInitialized: isDateInitialized.current,
      userHpcnaExpiryDate: user?.hpcnaExpiryDate,
      currentExpirationDate: expirationDate.toISOString(),
    });

    if (visible && !isDateInitialized.current) {
      if (user?.hpcnaExpiryDate) {
        console.log("📅 Setting expiration date from user:", user.hpcnaExpiryDate);
        setExpirationDate(new Date(user.hpcnaExpiryDate));
      } else {
        console.log("📅 Setting expiration date to current date");
        setExpirationDate(new Date());
      }
      isDateInitialized.current = true;
    } else if (!visible) {
      console.log("📅 Resetting initialization flag");
      isDateInitialized.current = false;
    }
  }, [visible]);

  const hasChanges = (): boolean => {
    if (!user) return true;

    const userSpecializations = user.specializations || [];
    const formSpecializations = formData.specializations;

    const specializationsChanged =
      userSpecializations.length !== formSpecializations.length ||
      !userSpecializations.every((spec) => formSpecializations.includes(spec));

    return (
      formData.fullname !== (user.fullname || "") ||
      formData.email !== (user.email || "") ||
      formData.cellphoneNumber !== (user.cellphoneNumber || "") ||
      formData.gender !== (user.gender || "Male") ||
      formData.address !== (user.address || "") ||
      formData.hpcnaNumber !== (user.hpcnaNumber || "") ||
      formData.hpcnaExpiryDate !== (user.hpcnaExpiryDate || "") ||
      specializationsChanged ||
      formData.yearsOfExperience !==
        (user.yearsOfExperience?.toString() || "") ||
      formData.operationalZone !== (user.operationalZone || "") ||
      formData.governingCouncil !== (user.governingCouncil || "") ||
      formData.bio !== (user.bio || "")
    );
  };

  const toggleSpecialization = (specTitle: string) => {
    setFormData((prev) => {
      const already = prev.specializations.includes(specTitle);
      return {
        ...prev,
        specializations: already
          ? prev.specializations.filter((s) => s !== specTitle)
          : [...prev.specializations, specTitle],
      };
    });
  };

  const getTodayStart = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today;
  };

  const clampToPresentOrFuture = (date: Date) => {
    const today = getTodayStart();
    const next = new Date(date);
    next.setHours(0, 0, 0, 0);
    return next < today ? today : date;
  };

  const onExpirationDateChange = (event: any, selectedDate?: Date) => {
    // Android dialog: close after selection/dismiss
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event.type === "set" && selectedDate) {
      const nextDate = clampToPresentOrFuture(selectedDate);
      lastSelectedDate.current = nextDate;
      setExpirationDate(nextDate);
      setFormData((prev) => ({
        ...prev,
        hpcnaExpiryDate: nextDate.toISOString(),
      }));
      setFieldErrors((prev) => {
        if (!prev.hpcnaExpiryDate) return prev;
        const next = { ...prev };
        delete next.hpcnaExpiryDate;
        return next;
      });
    } else if (
      Platform.OS === "android" &&
      (event.type === "dismissed" || event.type === "neutral") &&
      selectedDate
    ) {
      const isResettingToOriginal =
        selectedDate.getTime() === expirationDate.getTime();
      if (!isResettingToOriginal && lastSelectedDate.current) {
        const nextDate = clampToPresentOrFuture(lastSelectedDate.current);
        setExpirationDate(nextDate);
        setFormData((prev) => ({
          ...prev,
          hpcnaExpiryDate: nextDate.toISOString(),
        }));
      }
    }
  };

  const openExpirationDatePicker = () => {
    const safeDate = clampToPresentOrFuture(expirationDate);
    if (safeDate.getTime() !== expirationDate.getTime()) {
      setExpirationDate(safeDate);
      setFormData((prev) => ({
        ...prev,
        hpcnaExpiryDate: safeDate.toISOString(),
      }));
    }
    iosDateBeforeEdit.current = expirationDate;
    lastSelectedDate.current = safeDate;
    setShowDatePicker(true);
  };

  const confirmIosExpirationDate = () => {
    setShowDatePicker(false);
  };

  const cancelIosExpirationDate = () => {
    if (iosDateBeforeEdit.current) {
      setExpirationDate(iosDateBeforeEdit.current);
      setFormData((prev) => ({
        ...prev,
        hpcnaExpiryDate: iosDateBeforeEdit.current!.toISOString(),
      }));
    }
    setShowDatePicker(false);
  };

  // ── Inline error helper ────────────────────────────────────────────────────
  const setError = (field: string, msg: string | null) =>
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });

  const FieldError = ({ field }: { field: string }) =>
    fieldErrors[field] ? (
      <Text style={{ color: "#EF4444", fontSize: 12, marginTop: 4 }}>
        {fieldErrors[field]}
      </Text>
    ) : null;

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!hasChanges()) {
      Alert.alert("No Changes", "No changes have been made to your profile.");
      return;
    }

    // Build all errors up-front so every invalid field is highlighted at once
    const errors: Record<string, string> = {};

    if (!formData.fullname.trim()) errors.fullname = "Full name is required";

    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validatePhone(formData.cellphoneNumber);
    if (phoneErr) errors.cellphoneNumber = phoneErr;

    if (!formData.specializations.length)
      errors.specializations = "Select at least one specialization";

    if (!formData.hpcnaNumber.trim())
      errors.hpcnaNumber = "HPCNA registration number is required";

    const today = getTodayStart();
    const expiryDay = new Date(expirationDate);
    expiryDay.setHours(0, 0, 0, 0);
    if (expiryDay < today) {
      errors.hpcnaExpiryDate = "HPCNA expiry must be today or a future date";
    }

    const yearsErr = validateYears(formData.yearsOfExperience);
    if (yearsErr) errors.yearsOfExperience = yearsErr;

    if (!formData.operationalZone.trim())
      errors.operationalZone = "Please select your operational zone";

    if (!formData.bio.trim())
      errors.bio = "Professional bio is required";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return; // stop — fields will show their own errors

    // Convert to 264XXXXXXXXX — exactly what the backend validator expects
    const cleanedPhone = toBackendPhone(formData.cellphoneNumber);

    const payload = {
      fullname: formData.fullname,
      email: formData.email,
      cellphoneNumber: cleanedPhone,
      gender: formData.gender,
      address: formData.address,
      hpcnaNumber: formData.hpcnaNumber,
      hpcnaExpiryDate: expirationDate.toISOString(),
      specializations: formData.specializations,
      yearsOfExperience: parseInt(formData.yearsOfExperience),
      operationalZone: formData.operationalZone,
      governingCouncil: formData.governingCouncil,
      bio: formData.bio,
    };
    console.log("📤 [EditProfile] Sending payload:", JSON.stringify(payload, null, 2));

    setIsLoading(true);
    try {
      await apiClient.put("/app/auth/update-health-provider-details/", {
        fullname: formData.fullname,
        email: formData.email,
        cellphoneNumber: cleanedPhone,
        gender: formData.gender,
        address: formData.address,
        hpcnaNumber: formData.hpcnaNumber,
        hpcnaExpiryDate: expirationDate.toISOString(),
        specializations: formData.specializations,
        yearsOfExperience: parseInt(formData.yearsOfExperience),
        operationalZone: formData.operationalZone,
        governingCouncil: formData.governingCouncil,
        bio: formData.bio,
      });

      // Also save pharmacist-specific fields if the user is a pharmacist
      if (user?.role === "pharmacist") {
        await apiClient.put("/app/auth/update-pharmacy-profile", {
          registeredTradingName: formData.registeredTradingName,
          companyRegistrationNo: formData.companyRegistrationNo,
          businessEmail: formData.businessEmail,
          pharmacyCouncilNo: formData.pharmacyCouncilNo,
          practiceNumber: formData.practiceNumber,
          gpsLongitude: formData.gpsLongitude || undefined,
          gpsLatitude: formData.gpsLatitude || undefined,
          settlementCellNumber: formData.settlementCellNumber,
          hpcnaLicenseExpiryAcknowledged: formData.hpcnaLicenseExpiryAcknowledged,
        });
      }

      await updateUser({
        fullname: formData.fullname,
        email: formData.email,
        cellphoneNumber: cleanedPhone,
        gender: formData.gender as "Male" | "Female" | "Other",
        address: formData.address,
        hpcnaNumber: formData.hpcnaNumber,
        hpcnaExpiryDate: expirationDate.toISOString(),
        specializations: formData.specializations,
        yearsOfExperience: parseInt(formData.yearsOfExperience),
        operationalZone: formData.operationalZone,
        governingCouncil: formData.governingCouncil,
        bio: formData.bio,
      });

      setFieldErrors({});
      Alert.alert("Success", "Profile updated successfully");
      onClose();
    } catch (error: any) {
      console.log("❌ [EditProfile] API error:", JSON.stringify({
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      }, null, 2));
      // Surface backend error message directly — it's usually descriptive
      const msg: string =
        error.response?.data?.message || "Failed to update profile. Please try again.";
      // Try to map known backend messages to specific fields
      if (/cellphone|phone|mobile/i.test(msg)) {
        setError("cellphoneNumber", msg);
      } else if (/email/i.test(msg)) {
        setError("email", msg);
      } else if (/hpcna/i.test(msg)) {
        setError("hpcnaNumber", msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
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
            <Text style={styles.heroKicker}>Update your details</Text>
            <Text style={styles.heroTitle}>Edit profile</Text>
            <Text style={styles.heroSub}>
              Keep your professional information accurate for patients and compliance.
            </Text>
          </View>
        </SafeAreaView>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
        >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Basic Information Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionRail}>
              <View style={styles.railBar} />
              <Text style={styles.sectionTitle}>Basic information</Text>
            </View>

            {/* Full Name */}
            <View className="mb-4">
              <Text style={styles.label}>Full Name</Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: fieldErrors.fullname ? "#EF4444" : AUTH_COLORS.inputBorder, borderRadius: 12 })}
                placeholder="Enter full name"
                placeholderTextColor={AUTH_COLORS.placeholder}
                value={formData.fullname}
                onChangeText={(text) => {
                  setFormData({ ...formData, fullname: text });
                  if (fieldErrors.fullname) setError("fullname", null);
                }}
                editable={!isLoading}
              />
              <FieldError field="fullname" />
            </View>

            {/* Email */}
            <View className="mb-4">
              <Text style={styles.label}>Email</Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: fieldErrors.email ? "#EF4444" : AUTH_COLORS.inputBorder, borderRadius: 12 })}
                placeholder="Enter email"
                placeholderTextColor={AUTH_COLORS.placeholder}
                value={formData.email}
                onChangeText={(text) => {
                  setFormData({ ...formData, email: text });
                  if (fieldErrors.email) setError("email", null);
                }}
                keyboardType="email-address"
                editable={!isLoading}
                autoCapitalize="none"
              />
              <FieldError field="email" />
            </View>

            {/* Cellphone Number */}
            <View className="mb-4">
              <Text style={styles.label}>Cellphone Number</Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: fieldErrors.cellphoneNumber ? "#EF4444" : AUTH_COLORS.inputBorder, borderRadius: 12 })}
                placeholder="e.g. 0811234567"
                placeholderTextColor={AUTH_COLORS.placeholder}
                value={formData.cellphoneNumber}
                onChangeText={(text) => {
                  setFormData({ ...formData, cellphoneNumber: text });
                  if (fieldErrors.cellphoneNumber) setError("cellphoneNumber", null);
                }}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
              <FieldError field="cellphoneNumber" />
            </View>

            {/* Gender */}
            <View className="mb-4">
              <Text style={styles.label}>Gender</Text>
              <View className="flex-row gap-3">
                {["Male", "Female"].map((option) => (
                  <TouchableOpacity
                    key={option}
                    onPress={() =>
                      setFormData({
                        ...formData,
                        gender: option as "Male" | "Female",
                      })
                    }
                    disabled={isLoading}
                    style={[
                      styles.genderButton,
                      formData.gender === option && styles.genderButtonActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.genderText,
                        formData.gender === option && styles.genderTextActive,
                      ]}
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Address */}
            <View className="mb-1">
              <Text style={styles.label}>Address</Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                placeholder="Enter address"
                placeholderTextColor={AUTH_COLORS.placeholder}
                value={formData.address}
                onChangeText={(text) =>
                  setFormData({ ...formData, address: text })
                }
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Professional Details Section */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionRail}>
              <View style={styles.railBar} />
              <Text style={styles.sectionTitle}>Professional details</Text>
            </View>

            {/* Medical Council */}
            <View className="mb-4">
              <Text style={styles.label}>Medical Council</Text>
              <View style={styles.readOnlyField}>
                <Text style={styles.readOnlyText}>
                  {formData.governingCouncil}
                </Text>
              </View>
            </View>

            {/* Specializations */}
            <View className="mb-4">
              <Text style={styles.label}>Specializations</Text>
              <TextInput
                value={formData.specializations.join(", ")}
                editable={false}
                placeholder="Select specialization(s) below"
                placeholderTextColor={AUTH_COLORS.placeholder}
                className="bg-white rounded-lg px-4 py-3 text-gray-900 mb-2"
                style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
              />

              <FieldError field="specializations" />
              {loadingSpecializations ? (
                <View className="py-4">
                  <ActivityIndicator size="small" color={AUTH_COLORS.green} />
                  <Text className="text-center text-gray-500 mt-2 text-sm">
                    Loading specializations...
                  </Text>
                </View>
              ) : filteredSpecializations.length > 0 ? (
                <View className="flex-row flex-wrap gap-2">
                  {filteredSpecializations.map((spec) => {
                    const selected = formData.specializations.includes(
                      spec.title,
                    );
                    return (
                      <TouchableOpacity
                        key={spec._id}
                        onPress={() => toggleSpecialization(spec.title)}
                        disabled={isLoading}
                      >
                        <View
                          style={[
                            styles.specChip,
                            selected && styles.specChipActive,
                          ]}
                        >
                          <Text
                            style={[
                              styles.specChipText,
                              selected && styles.specChipTextActive,
                            ]}
                          >
                            {spec.title}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View style={styles.emptySpecs}>
                  <Text style={styles.emptySpecsText}>
                    No specializations available for {user?.role || "this role"}
                  </Text>
                </View>
              )}
            </View>

            {/* HPCNA Number */}
            <View className="mb-4">
              <Text style={styles.label}>HPCNA Registration Number</Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: fieldErrors.hpcnaNumber ? "#EF4444" : AUTH_COLORS.inputBorder, borderRadius: 12 })}
                placeholder="Enter HPCNA number"
                placeholderTextColor={AUTH_COLORS.placeholder}
                value={formData.hpcnaNumber}
                onChangeText={(text) => {
                  setFormData({ ...formData, hpcnaNumber: text });
                  if (fieldErrors.hpcnaNumber) setError("hpcnaNumber", null);
                }}
                editable={!isLoading}
              />
              <FieldError field="hpcnaNumber" />
            </View>

            {/* HPCNA Expiry Date */}
            <View style={styles.fieldBlock}>
              <Text style={styles.label}>HPCNA Expiry Date</Text>
              <TouchableOpacity
                onPress={openExpirationDatePicker}
                disabled={isLoading}
                style={[
                  styles.dateButton,
                  fieldErrors.hpcnaExpiryDate
                    ? { borderColor: "#EF4444" }
                    : null,
                ]}
              >
                <Text style={styles.dateButtonText}>
                  {expirationDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              <FieldError field="hpcnaExpiryDate" />
              {showDatePicker && Platform.OS === "android" ? (
                <DateTimePicker
                  key={datePickerKey.current}
                  value={clampToPresentOrFuture(expirationDate)}
                  mode="date"
                  display="default"
                  minimumDate={getTodayStart()}
                  onChange={onExpirationDateChange}
                />
              ) : null}
            </View>

            {showDatePicker && Platform.OS === "ios" ? (
              <Modal
                transparent
                animationType="slide"
                visible={showDatePicker}
                onRequestClose={cancelIosExpirationDate}
              >
                <View style={styles.iosPickerOverlay}>
                  <TouchableOpacity
                    style={styles.iosPickerBackdrop}
                    activeOpacity={1}
                    onPress={cancelIosExpirationDate}
                  />
                  <View style={styles.iosPickerSheet}>
                    <View style={styles.iosPickerToolbar}>
                      <TouchableOpacity
                        onPress={cancelIosExpirationDate}
                        hitSlop={12}
                      >
                        <Text style={styles.iosPickerCancel}>Cancel</Text>
                      </TouchableOpacity>
                      <Text style={styles.iosPickerTitle}>HPCNA expiry</Text>
                      <TouchableOpacity
                        onPress={confirmIosExpirationDate}
                        hitSlop={12}
                      >
                        <Text style={styles.iosPickerDone}>Done</Text>
                      </TouchableOpacity>
                    </View>
                    <DateTimePicker
                      key={datePickerKey.current}
                      value={clampToPresentOrFuture(expirationDate)}
                      mode="date"
                      display="spinner"
                      themeVariant="light"
                      minimumDate={getTodayStart()}
                      onChange={onExpirationDateChange}
                      style={styles.iosPicker}
                    />
                  </View>
                </View>
              </Modal>
            ) : null}

            {/* Years of Experience */}
            <View className="mb-4">
              <Text style={styles.label}>Years of Experience</Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: fieldErrors.yearsOfExperience ? "#EF4444" : AUTH_COLORS.inputBorder, borderRadius: 12 })}
                placeholder="Enter years (0 – 60)"
                placeholderTextColor={AUTH_COLORS.placeholder}
                value={formData.yearsOfExperience}
                onChangeText={(text) => {
                  setFormData({ ...formData, yearsOfExperience: text });
                  if (fieldErrors.yearsOfExperience) setError("yearsOfExperience", null);
                }}
                keyboardType="number-pad"
                editable={!isLoading}
              />
              <FieldError field="yearsOfExperience" />
            </View>

            {/* Operational Zone */}
            <View className="mb-4">
              <Text style={styles.label}>Operational Zone</Text>
              <PickerField
                value={formData.operationalZone}
                onValueChange={(v) => {
                  setFormData((p) => ({ ...p, operationalZone: String(v || "") }));
                  if (fieldErrors.operationalZone) setError("operationalZone", null);
                }}
                items={namibianRegions}
                placeholder="Select region…"
                disabled={isLoading}
                error={!!fieldErrors.operationalZone}
                borderColor={AUTH_COLORS.inputBorder}
              />
              <FieldError field="operationalZone" />
            </View>

            {/* Bio */}
            <View className="mb-1">
              <Text style={styles.label}>Professional Bio</Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={withIosMultilineTextInputStyle({
                  height: 120,
                  borderWidth: 2,
                  borderColor: fieldErrors.bio ? "#EF4444" : AUTH_COLORS.inputBorder,
                  borderRadius: 12,
                })}
                placeholder="Tell us about your professional experience and expertise"
                placeholderTextColor={AUTH_COLORS.placeholder}
                value={formData.bio}
                onChangeText={(text) => {
                  setFormData({ ...formData, bio: text });
                  if (fieldErrors.bio) setError("bio", null);
                }}
                multiline
                numberOfLines={5}
                editable={!isLoading}
                textAlignVertical="top"
              />
              <FieldError field="bio" />
            </View>
          </View>

          {/* ── Pharmacy Details (pharmacist only) ────────────────────────── */}
          {user?.role === "pharmacist" && (
            <View style={styles.sectionCard}>
              <View style={styles.pharmacyHeader}>
                <Feather name="package" size={16} color={AUTH_COLORS.white} />
                <Text style={styles.pharmacyHeaderText}>
                  Pharmacy Details
                </Text>
              </View>

              {/* Registered Trading Name */}
              <View className="mb-4">
                <Text style={styles.label}>
                  Registered Trading Name
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                  placeholder="Name on storefront / BIPA documents"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.registeredTradingName}
                  onChangeText={(t) => setFormData({ ...formData, registeredTradingName: t })}
                  editable={!isLoading}
                />
              </View>

              {/* Company Registration No */}
              <View className="mb-4">
                <Text style={styles.label}>
                  Company Registration No. (BIPA)
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                  placeholder="e.g. CC/20XX/XXXX"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.companyRegistrationNo}
                  onChangeText={(t) => setFormData({ ...formData, companyRegistrationNo: t })}
                  editable={!isLoading}
                />
              </View>

              {/* Business Email */}
              <View className="mb-4">
                <Text style={styles.label}>
                  Business Email
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                  placeholder="Official contact for orders and notifications"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.businessEmail}
                  onChangeText={(t) => setFormData({ ...formData, businessEmail: t })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              {/* Pharmacy Council No */}
              <View className="mb-4">
                <Text style={styles.label}>
                  Pharmacy Council No.
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                  placeholder="Premises registration with Pharmacy Council"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.pharmacyCouncilNo}
                  onChangeText={(t) => setFormData({ ...formData, pharmacyCouncilNo: t })}
                  editable={!isLoading}
                />
              </View>

              {/* Practice Number */}
              <View className="mb-4">
                <Text style={styles.label}>
                  Practice Number
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                  placeholder="Required for medical aid & billing"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.practiceNumber}
                  onChangeText={(t) => setFormData({ ...formData, practiceNumber: t })}
                  editable={!isLoading}
                />
              </View>

              {/* GPS Coordinates */}
              <View className="mb-4">
                <Text style={styles.label}>
                  GPS Coordinates (for dispatch)
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    className="bg-white rounded-lg px-4 py-3 text-gray-900"
                    style={withIosStandaloneTextInputStyle({ flex: 1, borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                    placeholder="Longitude"
                    placeholderTextColor={AUTH_COLORS.placeholder}
                    value={formData.gpsLongitude}
                    onChangeText={(t) => setFormData({ ...formData, gpsLongitude: t })}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  <TextInput
                    className="bg-white rounded-lg px-4 py-3 text-gray-900"
                    style={withIosStandaloneTextInputStyle({ flex: 1, borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                    placeholder="Latitude"
                    placeholderTextColor={AUTH_COLORS.placeholder}
                    value={formData.gpsLatitude}
                    onChangeText={(t) => setFormData({ ...formData, gpsLatitude: t })}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Settlement Cell Number */}
              <View className="mb-4">
                <Text style={styles.label}>
                  Settlement Cell Number
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={withIosStandaloneTextInputStyle({ borderWidth: 2, borderColor: AUTH_COLORS.inputBorder, borderRadius: 12 })}
                  placeholder="For prepaid software credit payouts"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={formData.settlementCellNumber}
                  onChangeText={(t) => setFormData({ ...formData, settlementCellNumber: t })}
                  keyboardType="phone-pad"
                  editable={!isLoading}
                />
              </View>

              {/* HPCNA License Expiry Acknowledgement */}
              <TouchableOpacity
                onPress={() =>
                  setFormData({
                    ...formData,
                    hpcnaLicenseExpiryAcknowledged: !formData.hpcnaLicenseExpiryAcknowledged,
                  })
                }
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                  backgroundColor: formData.hpcnaLicenseExpiryAcknowledged ? AUTH_COLORS.greenSoft : AUTH_COLORS.bg,
                  borderRadius: 12,
                  borderWidth: 2,
                  borderColor: formData.hpcnaLicenseExpiryAcknowledged ? AUTH_COLORS.inputBorder : "#D1D5DB",
                  padding: 12,
                  marginBottom: 4,
                }}
                disabled={isLoading}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    borderWidth: 2,
                    borderColor: formData.hpcnaLicenseExpiryAcknowledged ? AUTH_COLORS.green : "#9CA3AF",
                    backgroundColor: formData.hpcnaLicenseExpiryAcknowledged ? AUTH_COLORS.green : "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                >
                  {formData.hpcnaLicenseExpiryAcknowledged && (
                    <Feather name="check" size={13} color="#FFFFFF" />
                  )}
                </View>
                <Text style={{ fontSize: 13, color: AUTH_COLORS.textMuted, flex: 1, lineHeight: 18 }}>
                  I acknowledge my liability under HPCNA and confirm that my premises registration certificate is valid and up to date.
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            activeOpacity={0.85}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name="check" size={18} color="white" />
                <Text style={styles.saveButtonText}>
                  Save changes
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
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
  flex: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  sectionCard: {
    marginBottom: 18,
  },
  sectionRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
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
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
    alignItems: "center",
  },
  genderButtonActive: {
    backgroundColor: AUTH_COLORS.green,
    borderColor: AUTH_COLORS.greenDark,
  },
  genderText: {
    fontWeight: "600",
    color: AUTH_COLORS.textMuted,
  },
  genderTextActive: {
    color: AUTH_COLORS.white,
  },
  readOnlyField: {
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 0,
    borderBottomWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  readOnlyText: {
    color: AUTH_COLORS.textDark,
    fontWeight: "600",
  },
  specChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
  },
  specChipActive: {
    backgroundColor: "#0F3D24",
    borderColor: "#0F3D24",
  },
  specChipText: {
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
  },
  specChipTextActive: {
    color: AUTH_COLORS.white,
  },
  emptySpecs: {
    backgroundColor: AUTH_COLORS.greenSoft,
    padding: 14,
    borderRadius: 12,
  },
  emptySpecsText: {
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    fontSize: 13,
  },
  dateButton: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  dateButtonText: {
    color: AUTH_COLORS.textDark,
    fontSize: 16,
  },
  pharmacyHeader: {
    backgroundColor: "#0F3D24",
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pharmacyHeaderText: {
    fontSize: 14,
    fontWeight: "700",
    color: AUTH_COLORS.white,
  },
  saveButton: {
    backgroundColor: "#0F3D24",
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: AUTH_COLORS.white,
    fontWeight: "700",
    fontSize: 16,
  },
  fieldBlock: {
    marginBottom: 16,
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
