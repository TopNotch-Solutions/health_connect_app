import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
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
import MapView, { Marker } from "react-native-maps";
import {
  getCurrentLocationWithAddress,
  reverseGeocode,
} from "../../lib/geocoding";
import { PrescriptionFile } from "../../lib/prescription";
import { logViewMountDebug } from "../../lib/viewErrorLogger";

interface CreateRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (requestData: {
    ailmentCategory: string;
    ailmentCategoryId?: string;
    consultationMode: "house_visit" | "video_consultation";
    symptoms: string;
    paymentMethod: "wallet" | "cash";
    consultationCost: number;
    street: string;
    locality: string;
    region: string;
    preferredTime?: string;
    coordinates?: { latitude: number; longitude: number };
    prescriptionFile?: PrescriptionFile;
  }) => Promise<void>;
  selectedAilment?: any;
}

export default function CreateRequestModal({
  visible,
  onClose,
  onSubmit,
  selectedAilment = null,
}: CreateRequestModalProps) {
  const ailmentTitle = selectedAilment?.title || selectedAilment || "";
  const ailmentCategoryId = selectedAilment?._id;
  const supportsTeleconsultation = Boolean(
    selectedAilment?.supportsTeleconsultation,
  );
    const normalizeProviderLabel = (value?: string | null) =>
    String(value || "").trim().toLowerCase();
  const isPharmacyRequest =
    normalizeProviderLabel(selectedAilment?.provider) === "pharmacist";

  const [ailmentCategory, setAilmentCategory] = useState(ailmentTitle);
  const [consultationMode, setConsultationMode] = useState<
    "house_visit" | "video_consultation"
  >("house_visit");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "wallet">("cash");
  const [street, setStreet] = useState("");
  const [locality, setLocality] = useState("");
  const [region, setRegion] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [mapRegion, setMapRegion] = useState<{
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  } | null>(null);
  const [markerCoord, setMarkerCoord] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [showMap, setShowMap] = useState(false);

  const [prescriptionFile, setPrescriptionFile] =
    useState<PrescriptionFile | null>(null);
  
  const selectedCost =
    consultationMode === "video_consultation"
      ? Number(selectedAilment?.teleconsultationCost ?? NaN)
      : Number(selectedAilment?.physicalconsultationCost ?? NaN);

  // Load location when modal opens
  useEffect(() => {
    if (visible) {
      logViewMountDebug("CreateRequestModal", "modal opened", {
        showMap,
        mapRegion,
        markerCoord,
      });
      loadLocationAndAddress();
    }
  }, [visible]);

  // Update ailment category when selectedAilment changes
  useEffect(() => {
    if (selectedAilment) {
      const title = selectedAilment?.title || selectedAilment || "";
      setAilmentCategory(title);
    }
  }, [selectedAilment]);

  useEffect(() => {
    if (!supportsTeleconsultation && consultationMode === "video_consultation") {
      setConsultationMode("house_visit");
    }
  }, [consultationMode, supportsTeleconsultation]);
    useEffect(() => {
    if (visible) {
      setPrescriptionFile(null);
    }
  }, [visible, selectedAilment]);

  const loadLocationAndAddress = async () => {
    setIsLoadingLocation(true);
    try {
      const { latitude, longitude, address } =
        await getCurrentLocationWithAddress();

      // Set map region
      setMapRegion({
        latitude,
        longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });

      setMarkerCoord({ latitude, longitude });
      // Auto-show map once location is available
      setShowMap(true);

      // Set address fields
      setStreet(address.route || "Patient Location");
      setLocality(address.locality || "Current City");
      setRegion(address.administrative_area_level_1 || "Current Region");
    } catch (error: any) {
      console.error("Error loading location:", error);
      setShowMap(false);
      Alert.alert(
        "Location Error",
        error.message ||
          "Failed to get your location. Please check your location settings and try again.",
      );
    } finally {
      setIsLoadingLocation(false);
    }
  };

  const handleSubmit = async () => {
    // Validation
    if (!ailmentCategory.trim()) {
      Alert.alert("Required", "Please select or enter an ailment category");
      return;
    }

    if (!street.trim()) {
      Alert.alert("Required", "Please confirm your street address");
      return;
    }

    if (!locality.trim()) {
      Alert.alert("Required", "Please confirm your city/locality");
      return;
    }

    if (!region.trim()) {
      Alert.alert("Required", "Please confirm your region/province");
      return;
    }

    if (isNaN(selectedCost) || selectedCost <= 0) {
      Alert.alert(
        "Invalid Cost",
        "This ailment does not have a valid consultation cost configured.",
      );
      return;
    }

    // Ensure we have coordinates before submitting
    if (!markerCoord) {
      Alert.alert(
        "Location Required",
        "Please wait for your location to be detected or try again.",
      );
      return;
    }

    if (isPharmacyRequest && !prescriptionFile) {
      Alert.alert(
        "Prescription Required",
        "Please upload a prescription image or PDF before submitting a pharmacy request.",
      );
      return;
    }

    Alert.alert(
      "Confirm Request",
      `Submit a ${consultationMode === "video_consultation" ? "video consultation" : "house visit"} request for N$${selectedCost.toFixed(2)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Submit",
          onPress: async () => {
            setIsLoading(true);
            try {
              await onSubmit({
                ailmentCategory: ailmentCategory.trim(),
                ailmentCategoryId: ailmentCategoryId,
                consultationMode,
                symptoms: "",
                paymentMethod,
                consultationCost: selectedCost,
                street: street.trim(),
                locality: locality.trim(),
                region: region.trim(),
                preferredTime: undefined,
                coordinates: markerCoord,
                prescriptionFile: prescriptionFile || undefined,
              });

              // Don't reset form or close modal - let the parent handle navigation
              // The parent will navigate to waiting room, so we just need to close the modal
              onClose();
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to create request");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ],
    );
  };

  const handleMapPress = async (e: any) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;
    setMarkerCoord({ latitude, longitude });

    // Reverse geocode new location
    const address = await reverseGeocode(latitude, longitude);
    setStreet(address.route || "Patient Location");
    setLocality(address.locality || "Current City");
    setRegion(address.administrative_area_level_1 || "Current Region");
  };

  const pickPrescriptionImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library to upload a prescription.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    const asset = result.canceled ? null : result.assets?.[0] ?? null;
    if (!asset) return;

    setPrescriptionFile({
      uri: asset.uri,
      name: asset.fileName || `prescription_${Date.now()}.jpg`,
      mimeType: asset.mimeType || "image/jpeg",
    });
  };

  const pickPrescriptionPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    const asset = result.canceled ? null : result.assets?.[0] ?? null;
    if (!asset) return;

    const documentAsset = asset as DocumentPicker.DocumentPickerAsset & {
      fileCopyUri?: string | null;
    };

    setPrescriptionFile({
      uri: documentAsset.fileCopyUri || documentAsset.uri,
      name: asset.name || `prescription_${Date.now()}.pdf`,
      mimeType: "application/pdf",
    });
  };

  const paymentOptions = [
    { value: "cash", label: "Cash", icon: "dollar-sign" },
    { value: "wallet", label: "Wallet", icon: "credit-card" },
  ];
  const visiblePaymentOptions = paymentOptions.filter(
    (option) => option.value === "cash",
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 bg-black/50 justify-end">
          <View
            className="bg-gray-200 rounded-t-3xl flex-1"
            style={{ marginTop: "10%" }}
          >
            {/* Header */}
            <View className="flex-row items-center justify-between p-6 border-b border-gray-200">
              <Text className="text-2xl font-bold text-gray-900">
                Request Healthcare
              </Text>
              <TouchableOpacity onPress={onClose} disabled={isLoading}>
                <Feather name="x" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-6" showsVerticalScrollIndicator={false}>
              {/* Ailment Category */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Ailment Category *
                </Text>
                <TextInput
                  className="bg-gray-50 border border-gray-300 rounded-lg p-4 text-base"
                  placeholder="e.g., Flu, Cold & Cough"
                  value={ailmentCategory}
                  onChangeText={setAilmentCategory}
                  editable={false}
                />
              </View>

              {/* Consultation Mode */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Consultation Type *
                </Text>
                <View className="flex-row" style={{ gap: 10 }}>
                  <TouchableOpacity
                    onPress={() => setConsultationMode("house_visit")}
                    disabled={isLoading}
                    className={`flex-1 rounded-lg border-2 p-3 ${
                      consultationMode === "house_visit"
                        ? "bg-blue-50 border-blue-500"
                        : "bg-white border-gray-300"
                    }`}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        consultationMode === "house_visit"
                          ? "text-blue-700"
                          : "text-gray-700"
                      }`}
                    >
                      House Visit
                    </Text>
                  </TouchableOpacity>
                  {supportsTeleconsultation && (
                    <TouchableOpacity
                      onPress={() => setConsultationMode("video_consultation")}
                      disabled={isLoading}
                      className={`flex-1 rounded-lg border-2 p-3 ${
                        consultationMode === "video_consultation"
                          ? "bg-blue-50 border-blue-500"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      <Text
                        className={`text-center font-semibold ${
                          consultationMode === "video_consultation"
                            ? "text-blue-700"
                            : "text-gray-700"
                        }`}
                      >
                        Video Consultation
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>

                {!supportsTeleconsultation && (
                  <Text className="text-xs text-gray-600 mt-2">
                    This ailment currently requires an in-person house visit.
                  </Text>
                )}

                <View className="bg-amber-50 rounded-lg p-3 mt-3 border border-amber-300">
                  <Text className="text-xs font-bold text-amber-900 mb-1">
                    Disclaimer
                  </Text>
                  {consultationMode === "house_visit" ? (
                    <Text className="text-xs text-amber-800 leading-5">
                      Activate House Visit when you need a physical examination,
                      procedure, or in-person assessment at your location.
                    </Text>
                  ) : (
                    <Text className="text-xs text-amber-800 leading-5">
                      Activate Video Consultation for follow-ups and
                      non-emergency cases when you have stable internet, camera,
                      and audio.
                    </Text>
                  )}
                </View>
              </View>

              {/* Map Section */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-semibold text-gray-900">
                    Your Location *
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowMap(!showMap)}
                    disabled={isLoading}
                    className="bg-blue-100 px-3 py-1 rounded-full border border-blue-500"
                  >
                    <Text className="text-blue-600 text-sm font-semibold">
                      {showMap ? "Hide Map" : "Show Map"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {isLoadingLocation ? (
                  <View className="bg-gray-50 border border-gray-300 rounded-lg p-8 items-center justify-center h-64">
                    <ActivityIndicator color="#3B82F6" size="large" />
                    <Text className="text-gray-600 mt-3">
                      Loading your location...
                    </Text>
                  </View>
                ) : showMap && mapRegion && markerCoord ? (
                  <View className="bg-gray-50 border border-gray-300 rounded-lg overflow-hidden h-64 mb-3">
                    <MapView
                      region={mapRegion}
                      style={{ flex: 1 }}
                      onLayout={(event) => {
                        logViewMountDebug("CreateRequestModal", "MapView layout", {
                          layout: event.nativeEvent.layout,
                          mapRegion,
                          markerCoord,
                        });
                      }}
                      onMapReady={() => {
                        logViewMountDebug("CreateRequestModal", "MapView ready", {
                          mapRegion,
                          markerCoord,
                        });
                      }}
                      scrollEnabled={false}
                      zoomEnabled={false}
                      pitchEnabled={false}
                      rotateEnabled={false}
                    >
                      <Marker coordinate={markerCoord} />
                    </MapView>
                    <View className="bg-blue-50 p-2 flex-row items-center">
                      <Feather name="info" size={14} color="#3B82F6" />
                      <Text className="text-xs text-blue-700 ml-2 flex-1">
                        Your location
                      </Text>
                    </View>
                  </View>
                ) : null}

                {/* Address fields - auto-populated from map */}
                <View className="bg-amber-50 rounded-lg p-3 mb-3 flex-row items-start border border-amber-300">
                  <Feather name="map-pin" size={16} color="#92400E" />
                  <View className="ml-2 flex-1">
                    <Text className="text-sm font-semibold text-amber-900">
                      Auto-populated from location
                    </Text>
                    <Text className="text-xs text-amber-800 mt-1">
                      Your location is automatically detected and displayed
                    </Text>
                  </View>
                </View>
              </View>

              {/* Street Address */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Street Address *
                </Text>
                <TextInput
                  className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-base text-gray-600"
                  placeholder="e.g., 123 Main Street"
                  value={street}
                  onChangeText={setStreet}
                  editable={false}
                />
              </View>

              {/* Locality */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  City/Locality *
                </Text>
                <TextInput
                  className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-base text-gray-600"
                  placeholder="e.g., Cape Town"
                  value={locality}
                  onChangeText={setLocality}
                  editable={false}
                />
              </View>

              {/* Region */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Region/Province *
                </Text>
                <TextInput
                  className="bg-gray-100 border border-gray-300 rounded-lg p-4 text-base text-gray-600"
                  placeholder="e.g., Western Cape"
                  value={region}
                  onChangeText={setRegion}
                  editable={false}
                />
              </View>

              {/* Due Cost */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Consultation Cost (N$) *
                </Text>
                <View className="bg-blue-50 border border-blue-300 rounded-lg p-4">
                  <View className="flex-row items-center justify-between">
                    <View className="flex-row items-center flex-1">
                        <Feather name="dollar-sign" size={20} color="#3B82F6" />
                        <Text className="text-2xl font-bold text-blue-900 ml-2">
                          N${isNaN(selectedCost) ? "0.00" : selectedCost.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                </View>
              </View>

              {isPharmacyRequest && (
                <View className="mb-6">
                  <Text className="text-base font-semibold text-gray-900 mb-2">
                    Prescription *
                  </Text>
                  <Text className="text-xs text-gray-600 mb-3">
                    Upload a clear photo or PDF of your prescription before
                    submitting.
                  </Text>

                  {prescriptionFile && (
                    <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex-row items-center mb-3">
                      <Feather
                        name={prescriptionFile.mimeType === "application/pdf" ? "file-text" : "image"}
                        size={16}
                        color="#2563EB"
                      />
                      <Text
                        className="text-xs text-blue-700 ml-2 flex-1"
                        numberOfLines={1}
                      >
                        {prescriptionFile.name}
                      </Text>
                      <Feather name="check-circle" size={14} color="#16A34A" />
                    </View>
                  )}

                  <View className="flex-row" style={{ gap: 10 }}>
                    <TouchableOpacity
                      onPress={pickPrescriptionImage}
                      disabled={isLoading}
                      className="flex-1 bg-emerald-600 rounded-lg py-3 px-4 items-center flex-row justify-center"
                      style={{ gap: 6 }}
                    >
                      <Feather name="image" size={16} color="#FFFFFF" />
                      <Text className="text-white font-bold text-xs">
                        {prescriptionFile ? "Replace Image" : "Upload Image"}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={pickPrescriptionPdf}
                      disabled={isLoading}
                      className="flex-1 bg-blue-50 border border-blue-300 rounded-lg py-3 px-4 items-center flex-row justify-center"
                      style={{ gap: 6 }}
                    >
                      <Feather name="file-text" size={16} color="#2563EB" />
                      <Text className="text-blue-700 font-bold text-xs">
                        {prescriptionFile ? "Replace PDF" : "Upload PDF"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
              
              {/* Payment Method */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Payment Method *
                </Text>
                <View className="flex-row gap-3">
                  {visiblePaymentOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      onPress={() => setPaymentMethod(option.value as any)}
                      disabled={isLoading}
                      className={`flex-1 flex-row items-center justify-center p-4 rounded-lg border-2 ${
                        paymentMethod === option.value
                          ? "bg-blue-50 border-blue-500"
                          : "bg-white border-gray-300"
                      }`}
                    >
                      <Feather
                        name={option.icon as any}
                        size={20}
                        color={
                          paymentMethod === option.value ? "#3B82F6" : "#6B7280"
                        }
                      />
                      <Text
                        className={`ml-2 font-semibold ${
                          paymentMethod === option.value
                            ? "text-blue-600"
                            : "text-gray-600"
                        }`}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                {consultationMode === "video_consultation" && (
                  <Text className="text-xs text-gray-600 mt-2">
                    Video consultations are created as cash payments. After a
                    provider accepts, you&apos;ll see their number and payment
                    instructions before the call is unlocked.
                  </Text>
                )}
              </View>

              {/* Info Box */}
              <View className="bg-amber-50 rounded-lg p-4 mb-6 border border-amber-300">
                <View className="flex-row items-start">
                  <Feather name="info" size={20} color="#92400E" />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm text-amber-900 font-semibold mb-1">
                      Request will be sent to nearby providers
                    </Text>
                    <Text className="text-sm text-amber-800">
                      Your location will be shared with the healthcare provider
                      who accepts your request. The request expires after 6
                      hours if not accepted.
                    </Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            {/* Footer Actions */}
            <View className="p-6 border-t border-gray-200">
              <TouchableOpacity
                onPress={handleSubmit}
                disabled={isLoading}
                className={`py-4 rounded-lg ${
                  isLoading ? "bg-blue-300" : "bg-blue-600"
                }`}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white text-center text-lg font-semibold">
                    Submit Request
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
