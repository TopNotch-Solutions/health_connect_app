import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { namibianRegions } from "../constants/locations";
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";

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

  const onExpirationDateChange = (event: any, selectedDate?: Date) => {
    console.log("📅 Calendar onChange triggered:", {
      eventType: event.type,
      selectedDate: selectedDate?.toISOString(),
      currentExpirationDate: expirationDate.toISOString(),
      lastSelectedDate: lastSelectedDate.current?.toISOString(),
    });

    // Only update the date when the user actually selects a date (eventType: "set")
    if (event.type === "set" && selectedDate) {
      console.log("📅 Setting new expiration date:", selectedDate.toISOString());
      lastSelectedDate.current = selectedDate;
      setExpirationDate(selectedDate);
      setFormData((prev) => ({
        ...prev,
        hpcnaExpiryDate: selectedDate.toISOString(),
      }));
    } else if ((event.type === "dismissed" || event.type === "neutral") && selectedDate) {
      // Check if the dismissed event is trying to reset to the original date
      const isResettingToOriginal = selectedDate.getTime() === expirationDate.getTime();
      console.log("📅 Calendar dismissed/neutral, isResettingToOriginal:", isResettingToOriginal);

      // Only update if it's not resetting to the original date
      if (!isResettingToOriginal && lastSelectedDate.current) {
        console.log("📅 Keeping last selected date:", lastSelectedDate.current.toISOString());
        setExpirationDate(lastSelectedDate.current);
        setFormData((prev) => ({
          ...prev,
          hpcnaExpiryDate: lastSelectedDate.current!.toISOString(),
        }));
      }
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
      <View className="flex-1 bg-gray-50">
        {/* Header */}
        <View className="bg-white border-b border-gray-200 pt-12 pb-4 px-4 flex-row items-center justify-between">
          <Text className="text-xl font-bold text-gray-900">Edit Profile</Text>
          <TouchableOpacity onPress={onClose}>
            <Feather name="x" size={24} color="#6B7280" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-6">
          {/* Basic Information Section */}
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              Basic Information
            </Text>

            {/* Full Name */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Full Name
              </Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={{ borderWidth: 1, borderColor: fieldErrors.fullname ? "#EF4444" : "#D1D5DB" }}
                placeholder="Enter full name"
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
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Email
              </Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={{ borderWidth: 1, borderColor: fieldErrors.email ? "#EF4444" : "#D1D5DB" }}
                placeholder="Enter email"
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
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Cellphone Number
              </Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={{ borderWidth: 1, borderColor: fieldErrors.cellphoneNumber ? "#EF4444" : "#D1D5DB" }}
                placeholder="e.g. 0811234567"
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
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Gender
              </Text>
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
                    className={`flex-1 py-3 rounded-lg border-2 items-center ${
                      formData.gender === option
                        ? "bg-blue-50 border-blue-500"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <Text
                      className={
                        formData.gender === option
                          ? "text-blue-600 font-semibold"
                          : "text-gray-700"
                      }
                    >
                      {option}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Address */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Address
              </Text>
              <TextInput
                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900"
                placeholder="Enter address"
                value={formData.address}
                onChangeText={(text) =>
                  setFormData({ ...formData, address: text })
                }
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Professional Details Section */}
          <View className="mb-6">
            <Text className="text-lg font-bold text-gray-900 mb-4">
              Professional Details
            </Text>

            {/* Medical Council */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Medical Council
              </Text>
              <View className="bg-gray-100 border border-gray-300 rounded-lg px-4 py-3">
                <Text className="text-gray-700">
                  {formData.governingCouncil}
                </Text>
              </View>
            </View>

            {/* Specializations */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Specializations
              </Text>
              <TextInput
                value={formData.specializations.join(", ")}
                editable={false}
                placeholder="Select specialization(s) below"
                className="bg-white border border-gray-300 rounded-lg px-4 py-3 text-gray-900 mb-2"
              />

              <FieldError field="specializations" />
              {loadingSpecializations ? (
                <View className="py-4">
                  <ActivityIndicator size="small" color="#3B82F6" />
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
                          className={`px-4 py-2 rounded-full ${
                            selected ? "bg-blue-600" : "bg-gray-200"
                          }`}
                        >
                          <Text
                            className={`${
                              selected ? "text-white" : "text-gray-700"
                            } font-semibold`}
                          >
                            {spec.title}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View className="bg-gray-100 p-4 rounded-lg">
                  <Text className="text-gray-600 text-center text-sm">
                    No specializations available for {user?.role || "this role"}
                  </Text>
                </View>
              )}
            </View>

            {/* HPCNA Number */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                HPCNA Registration Number
              </Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={{ borderWidth: 1, borderColor: fieldErrors.hpcnaNumber ? "#EF4444" : "#D1D5DB" }}
                placeholder="Enter HPCNA number"
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
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                HPCNA Expiry Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                disabled={isLoading}
                className="bg-white border border-gray-300 rounded-lg px-4 py-3"
              >
                <Text className="text-gray-900">
                  {expirationDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  key={datePickerKey.current}
                  value={expirationDate}
                  mode="date"
                  display="default"
                  onChange={onExpirationDateChange}
                />
              )}
            </View>

            {/* Years of Experience */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Years of Experience
              </Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={{ borderWidth: 1, borderColor: fieldErrors.yearsOfExperience ? "#EF4444" : "#D1D5DB" }}
                placeholder="Enter years (0 – 60)"
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
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Operational Zone
              </Text>
              <View
                className="bg-white rounded-lg px-3"
                style={{
                  height: 56,
                  justifyContent: "center",
                  borderWidth: 1,
                  borderColor: fieldErrors.operationalZone ? "#EF4444" : "#D1D5DB",
                }}
              >
                <RNPickerSelect
                  onValueChange={(v) => {
                    setFormData((p) => ({ ...p, operationalZone: String(v || "") }));
                    if (fieldErrors.operationalZone) setError("operationalZone", null);
                  }}
                  value={formData.operationalZone}
                  items={namibianRegions}
                  placeholder={{ label: "Select region…", value: "" }}
                  disabled={isLoading}
                  Icon={() => null}
                  useNativeAndroidPickerStyle={false}
                  style={{
                    inputAndroid: { fontSize: 16, color: "#111" },
                    inputIOS: { fontSize: 16, color: "#111" },
                    placeholder: { color: "#9CA3AF" },
                  }}
                />
              </View>
              <FieldError field="operationalZone" />
            </View>

            {/* Bio */}
            <View className="mb-4">
              <Text className="text-sm font-semibold text-gray-700 mb-2">
                Professional Bio
              </Text>
              <TextInput
                className="bg-white rounded-lg px-4 py-3 text-gray-900"
                style={{
                  height: 120,
                  borderWidth: 1,
                  borderColor: fieldErrors.bio ? "#EF4444" : "#D1D5DB",
                }}
                placeholder="Tell us about your professional experience and expertise"
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
            <View className="mb-4">
              {/* Section header */}
              <View
                style={{
                  backgroundColor: "#10B981",
                  borderRadius: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 14,
                  marginBottom: 14,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <Feather name="package" size={16} color="#FFFFFF" />
                <Text style={{ fontSize: 14, fontWeight: "700", color: "#FFFFFF" }}>
                  Pharmacy Details
                </Text>
              </View>

              {/* Registered Trading Name */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Registered Trading Name
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={{ borderWidth: 1, borderColor: "#D1D5DB" }}
                  placeholder="Name on storefront / BIPA documents"
                  value={formData.registeredTradingName}
                  onChangeText={(t) => setFormData({ ...formData, registeredTradingName: t })}
                  editable={!isLoading}
                />
              </View>

              {/* Company Registration No */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Company Registration No. (BIPA)
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={{ borderWidth: 1, borderColor: "#D1D5DB" }}
                  placeholder="e.g. CC/20XX/XXXX"
                  value={formData.companyRegistrationNo}
                  onChangeText={(t) => setFormData({ ...formData, companyRegistrationNo: t })}
                  editable={!isLoading}
                />
              </View>

              {/* Business Email */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Business Email
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={{ borderWidth: 1, borderColor: "#D1D5DB" }}
                  placeholder="Official contact for orders and notifications"
                  value={formData.businessEmail}
                  onChangeText={(t) => setFormData({ ...formData, businessEmail: t })}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!isLoading}
                />
              </View>

              {/* Pharmacy Council No */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Pharmacy Council No.
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={{ borderWidth: 1, borderColor: "#D1D5DB" }}
                  placeholder="Premises registration with Pharmacy Council"
                  value={formData.pharmacyCouncilNo}
                  onChangeText={(t) => setFormData({ ...formData, pharmacyCouncilNo: t })}
                  editable={!isLoading}
                />
              </View>

              {/* Practice Number */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Practice Number
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={{ borderWidth: 1, borderColor: "#D1D5DB" }}
                  placeholder="Required for medical aid & billing"
                  value={formData.practiceNumber}
                  onChangeText={(t) => setFormData({ ...formData, practiceNumber: t })}
                  editable={!isLoading}
                />
              </View>

              {/* GPS Coordinates */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  GPS Coordinates (for dispatch)
                </Text>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <TextInput
                    className="bg-white rounded-lg px-4 py-3 text-gray-900"
                    style={{ flex: 1, borderWidth: 1, borderColor: "#D1D5DB" }}
                    placeholder="Longitude"
                    value={formData.gpsLongitude}
                    onChangeText={(t) => setFormData({ ...formData, gpsLongitude: t })}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                  <TextInput
                    className="bg-white rounded-lg px-4 py-3 text-gray-900"
                    style={{ flex: 1, borderWidth: 1, borderColor: "#D1D5DB" }}
                    placeholder="Latitude"
                    value={formData.gpsLatitude}
                    onChangeText={(t) => setFormData({ ...formData, gpsLatitude: t })}
                    keyboardType="numeric"
                    editable={!isLoading}
                  />
                </View>
              </View>

              {/* Settlement Cell Number */}
              <View className="mb-4">
                <Text className="text-sm font-semibold text-gray-700 mb-2">
                  Settlement Cell Number
                </Text>
                <TextInput
                  className="bg-white rounded-lg px-4 py-3 text-gray-900"
                  style={{ borderWidth: 1, borderColor: "#D1D5DB" }}
                  placeholder="For prepaid software credit payouts"
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
                  backgroundColor: formData.hpcnaLicenseExpiryAcknowledged ? "#ECFDF5" : "#F9FAFB",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: formData.hpcnaLicenseExpiryAcknowledged ? "#BBF7D0" : "#D1D5DB",
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
                    borderColor: formData.hpcnaLicenseExpiryAcknowledged ? "#10B981" : "#9CA3AF",
                    backgroundColor: formData.hpcnaLicenseExpiryAcknowledged ? "#10B981" : "#FFFFFF",
                    alignItems: "center",
                    justifyContent: "center",
                    marginTop: 1,
                  }}
                >
                  {formData.hpcnaLicenseExpiryAcknowledged && (
                    <Feather name="check" size={13} color="#FFFFFF" />
                  )}
                </View>
                <Text style={{ fontSize: 13, color: "#374151", flex: 1, lineHeight: 18 }}>
                  I acknowledge my liability under HPCNA and confirm that my premises registration certificate is valid and up to date.
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Save Button */}
          <TouchableOpacity
            onPress={handleSave}
            disabled={isLoading}
            className="bg-blue-600 py-4 rounded-lg mb-8 flex-row items-center justify-center"
            style={{
              shadowColor: "#3B82F6",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
          >
            {isLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <Feather name="check" size={20} color="white" />
                <Text className="text-white font-semibold ml-2 text-base">
                  Save Changes
                </Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
