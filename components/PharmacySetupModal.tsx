/**
 * PharmacySetupModal
 *
 * Dedicated setup screen for pharmacists — fields from the Pharmacy Category spec.
 * Fixes:
 *  - useRef guard prevents re-seeding on every render (reset bug)
 *  - KeyboardAvoidingView keeps fields visible above the keyboard
 *  - GPS replaced with "Detect My Location" button (expo-location)
 */

import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";

interface Props {
  visible: boolean;
  onClose: () => void;
}

interface FormState {
  registeredTradingName: string;
  companyRegistrationNo: string;
  businessEmail: string;
  pharmacyCouncilNo: string;
  practiceNumber: string;
  gpsLongitude: string;
  gpsLatitude: string;
  gpsAddress: string;
  settlementCellNumber: string;
  hpcnaExpiryDate: Date | null;
  hpcnaLicenseExpiryAcknowledged: boolean;
}

const EMPTY: FormState = {
  registeredTradingName: "",
  companyRegistrationNo: "",
  businessEmail: "",
  pharmacyCouncilNo: "",
  practiceNumber: "",
  gpsLongitude: "",
  gpsLatitude: "",
  gpsAddress: "",
  settlementCellNumber: "",
  hpcnaExpiryDate: null,
  hpcnaLicenseExpiryAcknowledged: false,
};

export default function PharmacySetupModal({ visible, onClose }: Props) {
  const { user, updateUser } = useAuth();
  const insets = useSafeAreaInsets();
  const scrollViewRef = useRef<ScrollView>(null);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  // Local cert flag — updated immediately on upload, not tied to user context re-renders
  const [hasCert, setHasCert] = useState(false);

  // Keep latest user value in a ref so the seed effect can read it without being reactive to it
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  // Guard: only seed once per open session — deps=[visible] only, NOT user
  const seededRef = useRef(false);
  useEffect(() => {
    if (visible && !seededRef.current) {
      seededRef.current = true;
      const u = userRef.current as any;
      if (!u) return;
      setHasCert(!!u.hpcnaCertificate);
      setForm({
        registeredTradingName: u.registeredTradingName || "",
        companyRegistrationNo: u.companyRegistrationNo || "",
        businessEmail: u.businessEmail || "",
        pharmacyCouncilNo: u.pharmacyCouncilNo || "",
        practiceNumber: u.practiceNumber || "",
        gpsLongitude: u.gpsCoordinates?.longitude?.toString() || "",
        gpsLatitude: u.gpsCoordinates?.latitude?.toString() || "",
        gpsAddress: u.gpsAddress || "",
        settlementCellNumber: u.settlementCellNumber || "",
        hpcnaExpiryDate: u.hpcnaExpiryDate ? new Date(u.hpcnaExpiryDate) : null,
        hpcnaLicenseExpiryAcknowledged: u.hpcnaLicenseExpiryAcknowledged || false,
      });
      setErrors({});
    }
    if (!visible) {
      seededRef.current = false;
    }
  }, [visible]); // NO user in deps — prevents re-seeding when updateUser fires

  const set = (key: keyof FormState, value: any) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined }));
  };

  // ── GPS detection ─────────────────────────────────────────────────────────
  const detectLocation = async () => {
    try {
      setIsDetectingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission needed",
          "Location permission is required to detect your pharmacy's position."
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      const { latitude, longitude } = loc.coords;

      // Reverse-geocode to get a human-readable address
      const [geo] = await Location.reverseGeocodeAsync({ latitude, longitude });
      const addressParts = [geo?.name, geo?.street, geo?.city, geo?.region]
        .filter(Boolean)
        .join(", ");

      setForm((prev) => ({
        ...prev,
        gpsLatitude: latitude.toFixed(6),
        gpsLongitude: longitude.toFixed(6),
        gpsAddress: addressParts || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      }));
    } catch (err) {
      Alert.alert("Location Error", "Could not detect location. Please try again.");
    } finally {
      setIsDetectingLocation(false);
    }
  };

  // ── Validation ─────────────────────────────────────────────────────────────
  const validate = () => {
    const e: Partial<Record<keyof FormState, string>> = {};
    if (!form.registeredTradingName.trim())
      e.registeredTradingName = "Registered trading name is required";
    if (!form.pharmacyCouncilNo.trim())
      e.pharmacyCouncilNo = "Pharmacy Council No. is required";
    if (!form.practiceNumber.trim())
      e.practiceNumber = "Practice number is required";
    if (!form.hpcnaExpiryDate)
      e.hpcnaExpiryDate = "HPCNA license expiry date is required";
    if (!form.hpcnaLicenseExpiryAcknowledged)
      e.hpcnaLicenseExpiryAcknowledged = "You must acknowledge liability under HPCNA";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validate()) {
      // Scroll to top so user can see which fields have errors
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    try {
      setIsSaving(true);
      const res = await apiClient.put("/app/auth/update-pharmacy-profile", {
        registeredTradingName: form.registeredTradingName.trim(),
        companyRegistrationNo: form.companyRegistrationNo.trim(),
        businessEmail: form.businessEmail.trim(),
        pharmacyCouncilNo: form.pharmacyCouncilNo.trim(),
        practiceNumber: form.practiceNumber.trim(),
        gpsLongitude: form.gpsLongitude || undefined,
        gpsLatitude: form.gpsLatitude || undefined,
        settlementCellNumber: form.settlementCellNumber.trim(),
        hpcnaExpiryDate: form.hpcnaExpiryDate?.toISOString(),
        hpcnaLicenseExpiryAcknowledged: form.hpcnaLicenseExpiryAcknowledged,
      });
      if (res.data?.user) {
        await updateUser({ ...(user as any), ...res.data.user });
      }
      Alert.alert(
        "Saved",
        "Pharmacy profile updated successfully.",
        [{ text: "OK", onPress: onClose }],
      );
    } catch (err: any) {
      Alert.alert("Save Failed", err?.response?.data?.message || "Could not save.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Certificate upload ─────────────────────────────────────────────────────
  const pickAndUploadCert = async (source: "image" | "document") => {
    try {
      let uri = "", name = "", mimeType = "";

      if (source === "image") {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
          Alert.alert("Permission needed", "Allow access to your photo library.");
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          quality: 0.9,
        });
        if (result.canceled || !result.assets[0]) return;
        uri = result.assets[0].uri;
        name = result.assets[0].fileName || `hpcna_cert_${Date.now()}.jpg`;
        mimeType = result.assets[0].mimeType || "image/jpeg";
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: "application/pdf",
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets[0]) return;
        uri = result.assets[0].uri;
        name = result.assets[0].name || `hpcna_cert_${Date.now()}.pdf`;
        mimeType = "application/pdf";
      }

      setIsUploadingCert(true);
      const fd = new FormData();
      fd.append("hpcnaCertificate", { uri, name, type: mimeType } as any);
      const res = await apiClient.patch("/app/auth/upload-hpcna-certificate", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      if (res.data?.hpcnaCertificate) {
        setHasCert(true); // update local flag immediately — no re-seed triggered
        await updateUser({ ...(user as any), hpcnaCertificate: res.data.hpcnaCertificate });
        Alert.alert("Uploaded", "HPCNA certificate uploaded successfully.");
      }
    } catch (err: any) {
      Alert.alert("Upload Failed", err?.response?.data?.message || "Could not upload certificate.");
    } finally {
      setIsUploadingCert(false);
    }
  };

  const certUploadOptions = () => {
    Alert.alert("Upload HPCNA Certificate", "Choose file type", [
      { text: "Photo / JPEG", onPress: () => pickAndUploadCert("image") },
      { text: "PDF Document", onPress: () => pickAndUploadCert("document") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  // Use local hasCert flag (not user context) so status banner never flickers on updateUser
  const certFilename: string | null = hasCert
    ? ((user as any)?.hpcnaCertificate || "uploaded")
    : null;
  const isExpired = form.hpcnaExpiryDate && form.hpcnaExpiryDate < new Date();
  const isSetupComplete = !!(
    form.registeredTradingName &&
    form.pharmacyCouncilNo &&
    form.practiceNumber &&
    hasCert &&
    form.hpcnaExpiryDate &&
    form.hpcnaLicenseExpiryAcknowledged
  );

  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "Select date";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: "#F9FAFB" }}>
        {/* Header */}
        <View
          style={{
            backgroundColor: "#FFFFFF",
            paddingTop: insets.top + 16,
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: "#E5E7EB",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <View>
            <Text style={{ fontSize: 18, fontWeight: "700", color: "#111827" }}>
              Pharmacy Setup
            </Text>
            <Text style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
              Complete your setup to receive prescription requests
            </Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Feather name="x" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {/* KeyboardAvoidingView keeps fields above the keyboard */}
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={0}
        >
          <ScrollView
            ref={scrollViewRef}
            contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Status banner */}
            <View
              style={{
                backgroundColor: isSetupComplete ? "#DCFCE7" : "#FEF9C3",
                borderRadius: 12,
                padding: 14,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginBottom: 24,
                borderWidth: 1,
                borderColor: isSetupComplete ? "#BBF7D0" : "#FDE68A",
              }}
            >
              <Feather
                name={isSetupComplete ? "check-circle" : "alert-circle"}
                size={18}
                color={isSetupComplete ? "#16A34A" : "#92400E"}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "700",
                    color: isSetupComplete ? "#166534" : "#92400E",
                  }}
                >
                  {isSetupComplete ? "Setup Complete" : "Setup Incomplete"}
                </Text>
                <Text style={{ fontSize: 12, color: isSetupComplete ? "#166534" : "#92400E", marginTop: 2 }}>
                  {isSetupComplete
                    ? "You are eligible to receive prescription delivery requests."
                    : "Fill in all required fields and upload your certificate to start receiving requests."}
                </Text>
              </View>
            </View>

            {/* ── Business Identity ────────────────────────────────── */}
            <SectionHeader icon="briefcase" title="Business Identity" />

            <Field
              label="Registered Trading Name *"
              placeholder="Name on storefront / BIPA documents"
              value={form.registeredTradingName}
              onChangeText={(t) => set("registeredTradingName", t)}
              error={errors.registeredTradingName}
            />
            <Field
              label="Company Registration No. (BIPA)"
              placeholder="e.g. CC/20XX/XXXX"
              value={form.companyRegistrationNo}
              onChangeText={(t) => set("companyRegistrationNo", t)}
              autoCapitalize="characters"
            />
            <Field
              label="Business Email"
              placeholder="Official contact for orders and notifications"
              value={form.businessEmail}
              onChangeText={(t) => set("businessEmail", t)}
              keyboardType="email-address"
              autoCapitalize="none"
            />

            {/* ── Regulatory ───────────────────────────────────────── */}
            <SectionHeader icon="shield" title="Regulatory" />

            <Field
              label="Pharmacy Council No. *"
              placeholder="Premises registration with Pharmacy Council"
              value={form.pharmacyCouncilNo}
              onChangeText={(t) => set("pharmacyCouncilNo", t)}
              error={errors.pharmacyCouncilNo}
            />
            <Field
              label="Practice Number *"
              placeholder="Required for medical aid and billing"
              value={form.practiceNumber}
              onChangeText={(t) => set("practiceNumber", t)}
              error={errors.practiceNumber}
            />

            {/* ── Documentation ────────────────────────────────────── */}
            <SectionHeader icon="file-text" title="Documentation" />

            {/* HPCNA Certificate */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
                HPCNA Premises Registration Certificate *
              </Text>
              <View
                style={{
                  backgroundColor: certFilename ? "#EFF6FF" : "#F9FAFB",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: certFilename ? "#BFDBFE" : "#D1D5DB",
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 10,
                  marginBottom: 8,
                }}
              >
                <Feather
                  name={certFilename ? "check-circle" : "file"}
                  size={18}
                  color={certFilename ? "#2563EB" : "#9CA3AF"}
                />
                <Text
                  style={{ flex: 1, fontSize: 13, color: certFilename ? "#1D4ED8" : "#9CA3AF" }}
                  numberOfLines={1}
                >
                  {certFilename ? "Certificate uploaded" : "No certificate uploaded yet"}
                </Text>
                {certFilename && <Feather name="check" size={14} color="#16A34A" />}
              </View>
              {isUploadingCert ? (
                <ActivityIndicator size="small" color="#10B981" style={{ alignSelf: "flex-start" }} />
              ) : (
                <TouchableOpacity
                  onPress={certUploadOptions}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    alignSelf: "flex-start",
                    backgroundColor: "#10B981",
                    borderRadius: 8,
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                  }}
                >
                  <Feather name="upload" size={14} color="#FFFFFF" />
                  <Text style={{ fontSize: 13, fontWeight: "600", color: "#FFFFFF" }}>
                    {certFilename ? "Replace Certificate" : "Upload Certificate"}
                  </Text>
                </TouchableOpacity>
              )}
            </View>

            {/* HPCNA Expiry Date */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
                HPCNA License Expiry Date *
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                style={{
                  backgroundColor: "#FFFFFF",
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: errors.hpcnaExpiryDate ? "#EF4444" : isExpired ? "#FCA5A5" : "#D1D5DB",
                  paddingHorizontal: 14,
                  paddingVertical: 13,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Text style={{ fontSize: 14, color: form.hpcnaExpiryDate ? (isExpired ? "#EF4444" : "#111827") : "#9CA3AF" }}>
                  {formatDate(form.hpcnaExpiryDate)}
                </Text>
                <Feather name="calendar" size={16} color={isExpired ? "#EF4444" : "#6B7280"} />
              </TouchableOpacity>
              {isExpired && (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                  <Feather name="alert-triangle" size={12} color="#EF4444" />
                  <Text style={{ fontSize: 11, color: "#EF4444" }}>
                    License has expired — renew before accepting requests
                  </Text>
                </View>
              )}
              {errors.hpcnaExpiryDate && (
                <Text style={{ fontSize: 11, color: "#EF4444", marginTop: 4 }}>
                  {errors.hpcnaExpiryDate}
                </Text>
              )}
            </View>

            {showDatePicker && (
              <DateTimePicker
                value={form.hpcnaExpiryDate || new Date()}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                minimumDate={new Date(2000, 0, 1)}
                onChange={(_, date) => {
                  setShowDatePicker(Platform.OS === "ios");
                  if (date) set("hpcnaExpiryDate", date);
                }}
              />
            )}

            {/* ── Operations ───────────────────────────────────────── */}
            <SectionHeader icon="map-pin" title="Operations" />

            {/* GPS — detect location button */}
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: "600", color: "#374151", marginBottom: 6 }}>
                Pharmacy Location (for dispatch)
              </Text>

              {/* Current location card */}
              {form.gpsLatitude && form.gpsLongitude ? (
                <View
                  style={{
                    backgroundColor: "#F0FDF4",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#BBF7D0",
                    padding: 12,
                    flexDirection: "row",
                    alignItems: "flex-start",
                    gap: 10,
                    marginBottom: 8,
                  }}
                >
                  <Feather name="map-pin" size={18} color="#16A34A" style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: "600", color: "#166534" }}>
                      Location Set
                    </Text>
                    <Text style={{ fontSize: 12, color: "#166534", marginTop: 2 }} numberOfLines={2}>
                      {form.gpsAddress || `${form.gpsLatitude}, ${form.gpsLongitude}`}
                    </Text>
                    <Text style={{ fontSize: 11, color: "#4ADE80", marginTop: 3 }}>
                      {parseFloat(form.gpsLatitude).toFixed(5)}, {parseFloat(form.gpsLongitude).toFixed(5)}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => { set("gpsLatitude", ""); set("gpsLongitude", ""); set("gpsAddress", ""); }}>
                    <Feather name="x-circle" size={16} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View
                  style={{
                    backgroundColor: "#F9FAFB",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "#D1D5DB",
                    padding: 12,
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <Feather name="map" size={24} color="#D1D5DB" />
                  <Text style={{ fontSize: 12, color: "#9CA3AF", marginTop: 6 }}>
                    No location set yet
                  </Text>
                </View>
              )}

              <TouchableOpacity
                onPress={detectLocation}
                disabled={isDetectingLocation}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  backgroundColor: isDetectingLocation ? "#E5E7EB" : "#2563EB",
                  borderRadius: 10,
                  paddingVertical: 12,
                  opacity: isDetectingLocation ? 0.7 : 1,
                }}
              >
                {isDetectingLocation ? (
                  <ActivityIndicator size="small" color="#6B7280" />
                ) : (
                  <Feather name="navigation" size={16} color="#FFFFFF" />
                )}
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: "600",
                    color: isDetectingLocation ? "#6B7280" : "#FFFFFF",
                  }}
                >
                  {isDetectingLocation
                    ? "Detecting location..."
                    : form.gpsLatitude
                    ? "Update My Location"
                    : "Detect My Location"}
                </Text>
              </TouchableOpacity>
              <Text style={{ fontSize: 11, color: "#9CA3AF", marginTop: 6, textAlign: "center" }}>
                Tap to automatically set your pharmacy's GPS coordinates
              </Text>
            </View>

            <Field
              label="Settlement Cell Number"
              placeholder="For prepaid software credit payouts"
              value={form.settlementCellNumber}
              onChangeText={(t) => set("settlementCellNumber", t)}
              keyboardType="phone-pad"
            />

            {/* ── Compliance ───────────────────────────────────────── */}
            <SectionHeader icon="check-square" title="Compliance" />

            <TouchableOpacity
              onPress={() => set("hpcnaLicenseExpiryAcknowledged", !form.hpcnaLicenseExpiryAcknowledged)}
              style={{
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 10,
                backgroundColor: form.hpcnaLicenseExpiryAcknowledged ? "#ECFDF5" : "#F9FAFB",
                borderRadius: 10,
                borderWidth: 1,
                borderColor: errors.hpcnaLicenseExpiryAcknowledged
                  ? "#EF4444"
                  : form.hpcnaLicenseExpiryAcknowledged
                  ? "#BBF7D0"
                  : "#D1D5DB",
                padding: 14,
                marginBottom: 4,
              }}
            >
              <View
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: form.hpcnaLicenseExpiryAcknowledged ? "#10B981" : "#9CA3AF",
                  backgroundColor: form.hpcnaLicenseExpiryAcknowledged ? "#10B981" : "#FFFFFF",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: 1,
                }}
              >
                {form.hpcnaLicenseExpiryAcknowledged && (
                  <Feather name="check" size={13} color="#FFFFFF" />
                )}
              </View>
              <Text style={{ fontSize: 13, color: "#374151", flex: 1, lineHeight: 19 }}>
                I acknowledge my liability under HPCNA and confirm that my premises
                registration certificate is valid and up to date.
              </Text>
            </TouchableOpacity>
            {errors.hpcnaLicenseExpiryAcknowledged && (
              <Text style={{ fontSize: 11, color: "#EF4444", marginTop: 4, marginBottom: 8 }}>
                {errors.hpcnaLicenseExpiryAcknowledged}
              </Text>
            )}

            {/* Save button */}
            <TouchableOpacity
              onPress={handleSave}
              disabled={isSaving}
              style={{
                backgroundColor: "#10B981",
                borderRadius: 12,
                paddingVertical: 15,
                alignItems: "center",
                   marginTop: 24,
                opacity: isSaving ? 0.6 : 1,
                flexDirection: "row",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Feather name="save" size={16} color="#FFFFFF" />
              )}
              <Text style={{ fontSize: 15, fontWeight: "700", color: "#FFFFFF" }}>
                {isSaving ? "Saving..." : "Save Pharmacy Setup"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View
      style={{
        backgroundColor: "#10B981",
        borderRadius: 10,
        paddingVertical: 8,
        paddingHorizontal: 14,
        marginBottom: 14,
        marginTop: 4,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
      }}
    >
      <Feather name={icon as any} size={15} color="#FFFFFF" />
      <Text style={{ fontSize: 13, fontWeight: "700", color: "#FFFFFF" }}>{title}</Text>
    </View>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChangeText,
  error,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
  keyboardType?: any;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          fontSize: 13,
          fontWeight: "600",
          color: "#374151",
          marginBottom: 6,
        }}
      >
        {label}
      </Text>
      <TextInput
        style={{
          borderWidth: 1,
          borderColor: error ? "#EF4444" : "#D1D5DB",
          borderRadius: 10,
          paddingHorizontal: 14,
          paddingVertical: 12,
          fontSize: 15,
          color: "#111827",
          backgroundColor: "#FFFFFF",
        }}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? "none"}
      />
      {error ? (
        <Text style={{ fontSize: 12, color: "#EF4444", marginTop: 4 }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}
