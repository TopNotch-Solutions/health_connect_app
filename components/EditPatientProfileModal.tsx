import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { SafeAreaView } from "react-native-safe-area-context";
import { namibianRegions, townsByRegion } from "../constants/locations";
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";

// ── Validation helpers ────────────────────────────────────────────────────────
function validatePhone(raw: string): string | null {
  const cleaned = raw.replace(/[\s\-().+]/g, "");
  if (!cleaned) return "Cellphone number is required";
  const local = cleaned.startsWith("264") && cleaned.length === 12
    ? "0" + cleaned.slice(3)
    : cleaned;
  if (!/^081\d{7}$/.test(local))
    return "Enter a valid Namibian mobile number (e.g. 0811234567 — 10 digits starting with 081)";
  return null;
}

function validateEmail(v: string): string | null {
  if (!v.trim()) return "Email is required";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()))
    return "Enter a valid email address (e.g. name@example.com)";
  return null;
}

/** Backend expects 12 digits, no +, starting with 26481 (e.g. 264817001001) */
function toBackendPhone(raw: string): string {
  const cleaned = raw.replace(/[\s\-().+]/g, "");
  if (cleaned.startsWith("264")) return cleaned;
  if (cleaned.startsWith("0")) return "264" + cleaned.slice(1);
  return cleaned;
}
// ─────────────────────────────────────────────────────────────────────────────

interface EditPatientProfileModalProps {
  visible: boolean;
  onClose: () => void;
}

const pickerStyle = {
  inputIOS: {
    color: "#111827",
    fontSize: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    paddingRight: 30,
  },
  inputAndroid: {
    color: "#111827",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingRight: 30,
  },
  iconContainer: {
    top: 16,
    right: 12,
  },
  placeholder: {
    color: "#9CA3AF",
  },
  modalViewMiddle: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalViewBottom: {
    backgroundColor: "white",
  },
  chevronContainer: {
    display: "none",
  },
};

export default function EditPatientProfileModal({
  visible,
  onClose,
}: EditPatientProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

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

  // Initialize availableTowns based on user's region
  const [availableTowns, setAvailableTowns] = useState<
    { label: string; value: string }[]
  >(user?.region ? townsByRegion[user.region] || [] : []);

  // Parse dateOfBirth string to Date object, or use current date as fallback
  const parseDate = (dateString: string | undefined): Date => {
    if (!dateString) return new Date();
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? new Date() : date;
  };

  const [formData, setFormData] = useState({
    fullname: user?.fullname || "",
    email: user?.email || "",
    cellphoneNumber: user?.cellphoneNumber || "",
    dateOfBirth: parseDate(user?.dateOfBirth),
    gender: user?.gender || "Male",
    address: user?.address || "",
    town: user?.town || "",
    region: user?.region || "",
    nationalId: user?.nationalId || "",
  });

  useEffect(() => {
    if (visible && user) {
      setFormData({
        fullname: user.fullname || "",
        email: user.email || "",
        cellphoneNumber: user.cellphoneNumber || "",
        dateOfBirth: parseDate(user.dateOfBirth),
        gender: user.gender || "Male",
        address: user.address || "",
        town: user.town || "",
        region: user.region || "",
        nationalId: user.nationalId || "",
      });

      // Set available towns based on the user's current region
      if (user.region) {
        setAvailableTowns(townsByRegion[user.region] || []);
      }
    }
  }, [visible, user]);

  const handleInputChange = (name: string, value: any) => {
    if (name === "region") {
      setAvailableTowns(townsByRegion[value] || []);
      setFormData((prev) => ({ ...prev, region: value, town: "" }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const onDateChange = (_: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }
    if (selectedDate) {
      setFormData({ ...formData, dateOfBirth: selectedDate });
      if (Platform.OS === "ios") {
        setShowDatePicker(false);
      }
    } else if (Platform.OS === "android") {
      // User cancelled on Android
      setShowDatePicker(false);
    }
  };

  const formatDate = (date: Date): string => {
    if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
      return "";
    }
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const hasChanges = (): boolean => {
    if (!user) return true;

    const originalDate = user.dateOfBirth
      ? formatDate(parseDate(user.dateOfBirth))
      : "";
    const currentDate = formatDate(formData.dateOfBirth);

    return (
      formData.fullname !== (user.fullname || "") ||
      formData.email !== (user.email || "") ||
      formData.cellphoneNumber !== (user.cellphoneNumber || "") ||
      currentDate !== originalDate ||
      formData.gender !== (user.gender || "Male") ||
      formData.address !== (user.address || "") ||
      formData.town !== (user.town || "") ||
      formData.region !== (user.region || "") ||
      formData.nationalId !== (user.nationalId || "")
    );
  };

  const handleSave = async () => {
    if (!hasChanges()) {
      Alert.alert("No Changes", "No changes have been made to your profile.");
      return;
    }

    // Validate all fields up-front so every error shows at once
    const errors: Record<string, string> = {};

    if (!formData.fullname.trim()) errors.fullname = "Full name is required";

    const emailErr = validateEmail(formData.email);
    if (emailErr) errors.email = emailErr;

    const phoneErr = validatePhone(formData.cellphoneNumber);
    if (phoneErr) errors.cellphoneNumber = phoneErr;

    if (
      !formData.dateOfBirth ||
      !(formData.dateOfBirth instanceof Date) ||
      isNaN(formData.dateOfBirth.getTime())
    ) errors.dateOfBirth = "Date of birth is required";

    if (!formData.address.trim()) errors.address = "Address is required";
    if (!formData.region.trim()) errors.region = "Please select a region";
    if (!formData.town.trim()) errors.town = "Please select a town";

    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    // Convert phone to backend format (264XXXXXXXXX)
    const backendPhone = toBackendPhone(formData.cellphoneNumber);

    const payload = {
      fullname: formData.fullname,
      email: formData.email,
      cellphoneNumber: backendPhone,
      dateOfBirth: formatDate(formData.dateOfBirth),
      gender: formData.gender,
      address: formData.address,
      town: formData.town,
      region: formData.region,
      nationalId: formData.nationalId,
    };

    console.log("📤 Request payload:", JSON.stringify(payload, null, 2));

    setIsLoading(true);
    try {
      const response = await apiClient.put(
        "/app/auth/update-patient-details",
        payload,
      );
      await updateUser(payload);
      setFieldErrors({});
      Alert.alert("Success", "Profile updated successfully");
      onClose();
    } catch (error: any) {
      console.log("❌ [EditPatient] API error:", JSON.stringify({
        status: error.response?.status,
        data: error.response?.data,
      }, null, 2));
      const msg: string =
        error.response?.data?.message || "Failed to update profile. Please try again.";
      if (/cellphone|phone|mobile/i.test(msg)) {
        setError("cellphoneNumber", msg);
      } else if (/email/i.test(msg)) {
        setError("email", msg);
      } else {
        Alert.alert("Error", msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.container} edges={["top"]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            activeOpacity={0.7}
          >
            <Feather name="x" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Full Name */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={[styles.input, fieldErrors.fullname ? styles.inputError : undefined]}
              placeholder="Enter full name"
              placeholderTextColor="#9CA3AF"
              value={formData.fullname}
              onChangeText={(text) => { handleInputChange("fullname", text); if (fieldErrors.fullname) setError("fullname", null); }}
              editable={!isLoading}
            />
            <FieldError field="fullname" />
          </View>

          {/* Email */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={[styles.input, fieldErrors.email ? styles.inputError : undefined]}
              placeholder="Enter email"
              placeholderTextColor="#9CA3AF"
              value={formData.email}
              onChangeText={(text) => { handleInputChange("email", text); if (fieldErrors.email) setError("email", null); }}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!isLoading}
            />
            <FieldError field="email" />
          </View>

          {/* Cellphone Number */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Cellphone Number</Text>
            <TextInput
              style={[styles.input, fieldErrors.cellphoneNumber ? styles.inputError : undefined]}
              placeholder="e.g. 0811234567"
              placeholderTextColor="#9CA3AF"
              value={formData.cellphoneNumber}
              onChangeText={(text) => { handleInputChange("cellphoneNumber", text); if (fieldErrors.cellphoneNumber) setError("cellphoneNumber", null); }}
              keyboardType="phone-pad"
              editable={!isLoading}
            />
            <FieldError field="cellphoneNumber" />
          </View>

          {/* Date of Birth */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Date of Birth</Text>
            <TouchableOpacity
              onPress={() => setShowDatePicker(true)}
              disabled={isLoading}
              style={[styles.input, fieldErrors.dateOfBirth ? styles.inputError : undefined]}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dateText,
                  !formData.dateOfBirth && styles.datePlaceholder,
                ]}
              >
                {formData.dateOfBirth
                  ? formatDate(formData.dateOfBirth)
                  : "Select date of birth"}
              </Text>
            </TouchableOpacity>
            <FieldError field="dateOfBirth" />
            {showDatePicker && (
              <DateTimePicker
                value={formData.dateOfBirth}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onDateChange}
                maximumDate={new Date()}
              />
            )}
          </View>

          {/* National ID */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>National ID Number</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter your 11-digit National ID"
              placeholderTextColor="#9CA3AF"
              value={formData.nationalId}
              onChangeText={(text) => {
                const numericOnly = text.replace(/[^0-9]/g, "");
                if (numericOnly.length <= 11) {
                  handleInputChange("nationalId", numericOnly);
                }
              }}
              keyboardType="numeric"
              maxLength={11}
              editable={!isLoading}
            />
          </View>

          {/* Gender */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Gender</Text>
            <View style={styles.genderContainer}>
              {["Male", "Female"].map((option) => (
                <TouchableOpacity
                  key={option}
                  onPress={() => handleInputChange("gender", option)}
                  disabled={isLoading}
                  style={[
                    styles.genderButton,
                    formData.gender === option && styles.genderButtonActive,
                  ]}
                  activeOpacity={0.7}
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
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Address</Text>
            <TextInput
              style={[styles.input, fieldErrors.address ? styles.inputError : undefined]}
              placeholder="Enter address"
              placeholderTextColor="#9CA3AF"
              value={formData.address}
              onChangeText={(text) => { handleInputChange("address", text); if (fieldErrors.address) setError("address", null); }}
              editable={!isLoading}
            />
            <FieldError field="address" />
          </View>

          {/* Region */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Region</Text>
            <View style={[styles.pickerContainer, fieldErrors.region ? styles.inputError : undefined]}>
              <RNPickerSelect
                onValueChange={(value) => { handleInputChange("region", value); if (fieldErrors.region) setError("region", null); }}
                items={namibianRegions}
                placeholder={{ label: "Select a region...", value: null }}
                value={formData.region}
                style={pickerStyle as any}
                useNativeAndroidPickerStyle={false}
              />
              <View style={styles.pickerIcon}>
                <Feather name="chevron-down" size={20} color="#D1D5DB" />
              </View>
            </View>
            <FieldError field="region" />
          </View>

          {/* Town */}
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Town</Text>
            <View
              style={[
                styles.pickerContainer,
                !formData.region && styles.pickerContainerDisabled,
                fieldErrors.town ? styles.inputError : undefined,
              ]}
            >
              <RNPickerSelect
                onValueChange={(value) => { handleInputChange("town", value); if (fieldErrors.town) setError("town", null); }}
                items={availableTowns}
                placeholder={{ label: "Select a town...", value: null }}
                value={formData.town}
                disabled={!formData.region}
                style={pickerStyle as any}
                useNativeAndroidPickerStyle={false}
              />
              <View style={styles.pickerIcon}>
                <Feather name="chevron-down" size={20} color="#D1D5DB" />
              </View>
            </View>
            <FieldError field="town" />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            style={[styles.saveButton, isLoading && styles.saveButtonDisabled]}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="check" size={20} color="#FFFFFF" />
                <Text style={styles.saveButtonText}>Save Changes</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F9FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
  },
  closeButton: {
    padding: 8,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: "#111827",
  },
  inputError: {
    borderColor: "#EF4444",
  },
  genderContainer: {
    flexDirection: "row",
    gap: 12,
  },
  genderButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  genderButtonActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  genderText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#6B7280",
  },
  genderTextActive: {
    color: "#FFFFFF",
  },
  pickerContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderColor: "#D1D5DB",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 56,
    justifyContent: "center",
    position: "relative",
  },
  pickerContainerDisabled: {
    borderColor: "#E5E7EB",
    opacity: 0.6,
  },
  pickerIcon: {
    position: "absolute",
    right: 16,
    top: 18,
    pointerEvents: "none",
  },
  saveButton: {
    backgroundColor: "#10B981",
    paddingVertical: 16,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    marginBottom: 20,
    shadowColor: "#10B981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginLeft: 8,
  },
  dateText: {
    fontSize: 16,
    color: "#111827",
  },
  datePlaceholder: {
    color: "#9CA3AF",
  },
});
