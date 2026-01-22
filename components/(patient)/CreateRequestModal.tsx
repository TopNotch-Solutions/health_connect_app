import { Feather } from "@expo/vector-icons";
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

interface CreateRequestModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (requestData: {
    ailmentCategory: string;
    ailmentCategoryId?: string;
    symptoms: string;
    paymentMethod: "wallet" | "cash";
    estimatedCost: number;
    street: string;
    locality: string;
    region: string;
    preferredTime?: string;
    coordinates?: { latitude: number; longitude: number };
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

  const [ailmentCategory, setAilmentCategory] = useState(ailmentTitle);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "cash">(
    "wallet",
  );
  const [dueCost, setDueCost] = useState("");
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

  // Load location when modal opens
  useEffect(() => {
    if (visible) {
      loadLocationAndAddress();
    }
  }, [visible]);

  // Update ailment category and due cost when selectedAilment changes
  useEffect(() => {
    if (selectedAilment) {
      const title = selectedAilment?.title || selectedAilment || "";
      setAilmentCategory(title);

      // Set due cost from ailment category's initialCost
      if (
        selectedAilment?.initialCost !== undefined &&
        selectedAilment?.initialCost !== null
      ) {
        setDueCost(selectedAilment.initialCost.toString());
      } else {
        // Fallback to 200 if initialCost is not available
        setDueCost("200");
      }
    }
  }, [selectedAilment]);

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

      // Set address fields
      setStreet(address.route || "Patient Location");
      setLocality(address.locality || "Current City");
      setRegion(address.administrative_area_level_1 || "Current Region");
    } catch (error: any) {
      console.error("Error loading location:", error);
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

    const cost = parseFloat(dueCost);
    if (isNaN(cost) || cost <= 0) {
      Alert.alert("Invalid Cost", "Please enter a valid due cost");
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

    setIsLoading(true);
    try {
      await onSubmit({
        ailmentCategory: ailmentCategory.trim(),
        ailmentCategoryId: ailmentCategoryId,
        symptoms: "",
        paymentMethod,
        estimatedCost: cost, // Changed from dueCost to estimatedCost to match backend
        street: street.trim(),
        locality: locality.trim(),
        region: region.trim(),
        preferredTime: undefined,
        coordinates: markerCoord,
      });

      // Reset form on success
      setAilmentCategory("");
      setPaymentMethod("wallet");
      setDueCost("0");
      setStreet("");
      setLocality("");
      setRegion("");
      setMapRegion(null);
      setMarkerCoord(null);
      setShowMap(false);
      onClose();
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create request");
    } finally {
      setIsLoading(false);
    }
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

  const paymentOptions = [
    { value: "wallet", label: "Wallet", icon: "credit-card" },
    { value: "cash", label: "Cash", icon: "dollar-sign" },
  ];

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

              {/* Map Section */}
              <View className="mb-6">
                <View className="flex-row items-center justify-between mb-3">
                  <Text className="text-base font-semibold text-gray-900">
                    Your Location *
                  </Text>
                  <TouchableOpacity
                    onPress={() => setShowMap(!showMap)}
                    disabled={isLoading}
                    className="bg-blue-100 px-3 py-1 rounded-full border border border-blue-500"
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
                <View className="bg-blue-50 rounded-lg p-3 mb-3 flex-row items-start border border-blue-500">
                  <Feather name="map-pin" size={16} color="#3B82F6" />
                  <View className="ml-2 flex-1">
                    <Text className="text-sm font-semibold text-blue-900">
                      Auto-populated from location
                    </Text>
                    <Text className="text-xs text-blue-800 mt-1">
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
                        N${parseFloat(dueCost).toFixed(2)}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Payment Method */}
              <View className="mb-6">
                <Text className="text-base font-semibold text-gray-900 mb-2">
                  Payment Method *
                </Text>
                <View className="flex-row gap-3">
                  {paymentOptions.map((option) => (
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
              </View>

              {/* Info Box */}
              <View className="bg-blue-50 rounded-lg p-4 mb-6 border border-blue-500">
                <View className="flex-row items-start">
                  <Feather name="info" size={20} color="#3B82F6" />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm text-blue-900 font-semibold mb-1">
                      Request will be sent to nearby providers
                    </Text>
                    <Text className="text-sm text-blue-800">
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
