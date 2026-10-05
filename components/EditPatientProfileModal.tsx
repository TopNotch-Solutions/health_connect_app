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
import { PickerField } from "./PickerField";
import { SafeAreaView } from "react-native-safe-area-context";
import { KEYBOARD_VERTICAL_OFFSET } from "./ScreenLayout";
import { namibianRegions, townsByRegion } from "../constants/locations";
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";
import { AUTH_COLORS } from "../lib/authScreenTheme";

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

export default function EditPatientProfileModal({
  visible,
  onClose,
}: EditPatientProfileModalProps) {
  const { user, updateUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const iosDateBeforeEdit = useRef<Date | null>(null);

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

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") {
      setShowDatePicker(false);
    }

    if (event?.type === "dismissed") return;

    if (selectedDate) {
      setFormData((prev) => ({ ...prev, dateOfBirth: selectedDate }));
      if (fieldErrors.dateOfBirth) setError("dateOfBirth", null);
    }
  };

  const openDatePicker = () => {
    iosDateBeforeEdit.current = formData.dateOfBirth;
    setShowDatePicker(true);
  };

  const confirmIosDate = () => {
    setShowDatePicker(false);
  };

  const cancelIosDate = () => {
    if (iosDateBeforeEdit.current) {
      setFormData((prev) => ({
        ...prev,
        dateOfBirth: iosDateBeforeEdit.current!,
      }));
    }
    setShowDatePicker(false);
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
              Keep your information current so we can reach you when care is needed.
            </Text>
          </View>
        </SafeAreaView>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.sheet}>
              <View style={styles.sectionRail}>
                <View style={styles.railBar} />
                <Text style={styles.sectionTitle}>About you</Text>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldIcon}>
                  <Feather name="user" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Full name</Text>
                  <TextInput
                    style={withIosStandaloneTextInputStyle([
                      styles.input,
                      fieldErrors.fullname ? styles.inputError : undefined,
                    ])}
                    placeholder="Enter full name"
                    placeholderTextColor={AUTH_COLORS.placeholder}
                    value={formData.fullname}
                    onChangeText={(text) => {
                      handleInputChange("fullname", text);
                      if (fieldErrors.fullname) setError("fullname", null);
                    }}
                    editable={!isLoading}
                  />
                  <FieldError field="fullname" />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldIcon}>
                  <Feather name="mail" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    style={withIosStandaloneTextInputStyle([
                      styles.input,
                      fieldErrors.email ? styles.inputError : undefined,
                    ])}
                    placeholder="Enter email"
                    placeholderTextColor={AUTH_COLORS.placeholder}
                    value={formData.email}
                    onChangeText={(text) => {
                      handleInputChange("email", text);
                      if (fieldErrors.email) setError("email", null);
                    }}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <FieldError field="email" />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldIcon}>
                  <Feather name="phone" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Cellphone</Text>
                  <TextInput
                    style={withIosStandaloneTextInputStyle([
                      styles.input,
                      fieldErrors.cellphoneNumber ? styles.inputError : undefined,
                    ])}
                    placeholder="e.g. 0811234567"
                    placeholderTextColor={AUTH_COLORS.placeholder}
                    value={formData.cellphoneNumber}
                    onChangeText={(text) => {
                      handleInputChange("cellphoneNumber", text);
                      if (fieldErrors.cellphoneNumber)
                        setError("cellphoneNumber", null);
                    }}
                    keyboardType="phone-pad"
                    editable={!isLoading}
                  />
                  <FieldError field="cellphoneNumber" />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldIcon}>
                  <Feather name="calendar" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Date of birth</Text>
                  <TouchableOpacity
                    onPress={openDatePicker}
                    disabled={isLoading}
                    style={withIosStandaloneTextInputStyle([
                      styles.input,
                      fieldErrors.dateOfBirth ? styles.inputError : undefined,
                    ])}
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
                  {showDatePicker && Platform.OS === "android" ? (
                    <DateTimePicker
                      value={formData.dateOfBirth || new Date()}
                      mode="date"
                      display="default"
                      onChange={onDateChange}
                      maximumDate={new Date()}
                    />
                  ) : null}
                </View>
              </View>

              {showDatePicker && Platform.OS === "ios" ? (
                <Modal
                  transparent
                  animationType="slide"
                  visible={showDatePicker}
                  onRequestClose={cancelIosDate}
                >
                  <View style={styles.iosPickerOverlay}>
                    <TouchableOpacity
                      style={styles.iosPickerBackdrop}
                      activeOpacity={1}
                      onPress={cancelIosDate}
                    />
                    <View style={styles.iosPickerSheet}>
                      <View style={styles.iosPickerToolbar}>
                        <TouchableOpacity onPress={cancelIosDate} hitSlop={12}>
                          <Text style={styles.iosPickerCancel}>Cancel</Text>
                        </TouchableOpacity>
                        <Text style={styles.iosPickerTitle}>Date of birth</Text>
                        <TouchableOpacity onPress={confirmIosDate} hitSlop={12}>
                          <Text style={styles.iosPickerDone}>Done</Text>
                        </TouchableOpacity>
                      </View>
                      <DateTimePicker
                        value={formData.dateOfBirth || new Date()}
                        mode="date"
                        display="spinner"
                        themeVariant="light"
                        onChange={onDateChange}
                        maximumDate={new Date()}
                        style={styles.iosPicker}
                      />
                    </View>
                  </View>
                </Modal>
              ) : null}

              <View style={styles.fieldBlock}>
                <View style={styles.fieldIcon}>
                  <Feather name="credit-card" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>National ID</Text>
                  <TextInput
                    style={withIosStandaloneTextInputStyle(styles.input)}
                    placeholder="11-digit National ID"
                    placeholderTextColor={AUTH_COLORS.placeholder}
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
              </View>

              <View style={[styles.fieldBlock, styles.fieldBlockLast]}>
                <View style={styles.fieldIcon}>
                  <Feather name="users" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.segment}>
                    {["Male", "Female"].map((option) => (
                      <TouchableOpacity
                        key={option}
                        onPress={() => handleInputChange("gender", option)}
                        disabled={isLoading}
                        style={[
                          styles.segmentItem,
                          formData.gender === option && styles.segmentItemActive,
                        ]}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.segmentText,
                            formData.gender === option &&
                              styles.segmentTextActive,
                          ]}
                        >
                          {option}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <View style={styles.sectionRail}>
                <View style={styles.railBar} />
                <Text style={styles.sectionTitle}>Where you live</Text>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldIcon}>
                  <Feather name="home" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Address</Text>
                  <TextInput
                    style={withIosStandaloneTextInputStyle([
                      styles.input,
                      fieldErrors.address ? styles.inputError : undefined,
                    ])}
                    placeholder="Enter address"
                    placeholderTextColor={AUTH_COLORS.placeholder}
                    value={formData.address}
                    onChangeText={(text) => {
                      handleInputChange("address", text);
                      if (fieldErrors.address) setError("address", null);
                    }}
                    editable={!isLoading}
                  />
                  <FieldError field="address" />
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <View style={styles.fieldIcon}>
                  <Feather name="map" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Region</Text>
                  <PickerField
                    value={formData.region}
                    onValueChange={(value) => {
                      handleInputChange("region", value);
                      if (fieldErrors.region) setError("region", null);
                    }}
                    items={namibianRegions}
                    placeholder="Select a region..."
                    error={!!fieldErrors.region}
                  />
                  <FieldError field="region" />
                </View>
              </View>

              <View style={[styles.fieldBlock, styles.fieldBlockLast]}>
                <View style={styles.fieldIcon}>
                  <Feather name="map-pin" size={16} color={AUTH_COLORS.green} />
                </View>
                <View style={styles.fieldBody}>
                  <Text style={styles.label}>Town</Text>
                  <PickerField
                    value={formData.town}
                    onValueChange={(value) => {
                      handleInputChange("town", value);
                      if (fieldErrors.town) setError("town", null);
                    }}
                    items={availableTowns}
                    placeholder="Select a town..."
                    disabled={!formData.region}
                    error={!!fieldErrors.town}
                  />
                  <FieldError field="town" />
                </View>
              </View>
            </View>
          </ScrollView>

          <SafeAreaView edges={["bottom"]} style={styles.footerSafe}>
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isLoading}
                style={[
                  styles.saveButton,
                  isLoading && styles.saveButtonDisabled,
                ]}
                activeOpacity={0.85}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save changes</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
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
    maxWidth: 300,
  },
  body: {
    flex: 1,
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    overflow: "hidden",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  sheet: {
    paddingBottom: 8,
  },
  sectionRail: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 18,
    marginTop: 8,
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
    letterSpacing: 0.2,
  },
  fieldBlock: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingBottom: 16,
    marginBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#D1D5DB",
  },
  fieldBlockLast: {
    borderBottomWidth: 0,
    marginBottom: 20,
  },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  fieldBody: {
    flex: 1,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  inputError: {
    borderColor: "#EF4444",
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
  saveButton: {
    backgroundColor: "#0F3D24",
    paddingVertical: 16,
    borderRadius: 16,
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
    fontSize: 16,
    fontWeight: "700",
  },
  dateText: {
    fontSize: 16,
    color: AUTH_COLORS.textDark,
  },
  datePlaceholder: {
    color: AUTH_COLORS.placeholder,
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
