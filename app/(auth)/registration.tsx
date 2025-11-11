// app/(auth)/registration.tsx
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { SafeAreaView } from "react-native-safe-area-context";
import { namibianRegions, townsByRegion } from "../../constants/locations";
import apiClient from "../../lib/api";

// Match ProviderRegistration's dropdown container + height + border tone
const PickerContainer = ({ children }: { children: React.ReactNode }) => (
  <View
    className="bg-white border border-gray-300 rounded-lg px-3"
    style={{ height: 56, justifyContent: "center" }}
  >
    {children}
  </View>
);

// Same custom RNPickerSelect style (chevron placement, padding on Android)
const pickerStyle = {
  inputIOS: { color: "black" },
  inputAndroid: { color: "black", paddingRight: 28 },
  iconContainer: { top: 16, right: 10 },
};

type FormState = {
  fullname: string;
  email: string;
  password: string;
  confirmPassword: string;
  cellphoneNumber: string;
  dateOfBirth: Date;
  gender: string;
  address: string;
  town: string;
  region: string;
  nationalId: string;
  profileImage: ImagePicker.ImagePickerAsset | null;
};

const RegistrationScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [formData, setFormData] = useState<FormState>({
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
    profileImage: null,
  });

  const [step, setStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTowns, setAvailableTowns] = useState<
    { label: string; value: string }[]
  >([]);

  useEffect(() => {
    if (params.cellphoneNumber && typeof params.cellphoneNumber === "string") {
      setFormData((prev) => ({
        ...prev,
        cellphoneNumber: params.cellphoneNumber as string,
      }));
    }
  }, [params.cellphoneNumber]);

  const handleInputChange = (name: keyof FormState, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "region") {
      setAvailableTowns(townsByRegion[value] || []);
      setFormData((prev) => ({ ...prev, town: "" }));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert(
        "Permission Denied",
        "We need camera roll permissions to select an image."
      );
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      handleInputChange("profileImage", result.assets[0]);
    }
  };

  const onDateChange = (_: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.dateOfBirth;
    setShowDatePicker(false); // mirror ProviderRegistration behavior
    handleInputChange("dateOfBirth", currentDate);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.fullname || !formData.email || !formData.password) {
        return Alert.alert("Error", "Please fill in all account details.");
      }
      if (formData.password !== formData.confirmPassword) {
        return Alert.alert("Error", "Passwords do not match.");
      }
    }
    if (step === 3) {
      if (!formData.address || !formData.region || !formData.town) {
        return Alert.alert(
          "Error",
          "Please complete your address, region, and town."
        );
      }
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => setStep((prev) => prev - 1);

  const handleRegister = async () => {
    if (!formData.nationalId) {
      return Alert.alert("Error", "Please add your National ID.");
    }

    setIsLoading(true);

    const data = new FormData();

    if (formData.profileImage) {
      const uri = formData.profileImage.uri;
      const uriParts = uri.split(".");
      const fileType = uriParts[uriParts.length - 1] || "jpg";
      data.append(
        "profileImage",
        {
          uri,
          name: `profile.${fileType}`,
          type: `image/${fileType}`,
        } as any
      );
    }

    (Object.keys(formData) as (keyof FormState)[]).forEach((key) => {
      if (key === "profileImage" || key === "confirmPassword") return;
      const value = formData[key];
      if (key === "dateOfBirth" && value instanceof Date) {
        data.append(key, value.toISOString().split("T")[0]);
      } else if (typeof value === "string" || typeof value === "number") {
        data.append(key, String(value));
      }
    });

    try {
      const response = await apiClient.post("/app/auth/register-patient", data, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (response.status === 201) {
        Alert.alert("Success", "Patient registration completed successfully.");
        router.push("/(auth)/sign-in");
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message || "An error occurred. Please try again.";
      Alert.alert("Registration Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ paddingBottom: step < 4 ? 120 : 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 pt-6">
          {/* Header (match ProviderRegistration styles) */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">Create Account</Text>
            <Text className="text-base text-gray-900 font-medium mt-3">
              Step {step} of 4
            </Text>
          </View>

          {/* STEP 1: Account Info */}
          {step === 1 && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Full Name</Text>
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Enter your full name"
                placeholderTextColor="#9CA3AF"
                value={formData.fullname}
                onChangeText={(val) => handleInputChange("fullname", val)}
              />

              <Text className="text-sm font-medium text-gray-700 mb-2">Email</Text>
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="youremail@example.com"
                placeholderTextColor="#9CA3AF"
                value={formData.email}
                onChangeText={(val) => handleInputChange("email", val)}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text className="text-sm font-medium text-gray-700 mb-2">Password</Text>
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Create a password"
                placeholderTextColor="#9CA3AF"
                value={formData.password}
                onChangeText={(val) => handleInputChange("password", val)}
                secureTextEntry
              />

              <Text className="text-sm font-medium text-gray-700 mb-2">Confirm Password</Text>
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Confirm your password"
                placeholderTextColor="#9CA3AF"
                value={formData.confirmPassword}
                onChangeText={(val) => handleInputChange("confirmPassword", val)}
                secureTextEntry
              />
            </View>
          )}

          {/* STEP 2: Personal Info */}
          {step === 2 && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Verified Phone Number
              </Text>
              <View className="w-full bg-gray-100 px-4 py-3.5 rounded-lg mb-4 border border-gray-300">
                <Text className="text-base text-gray-600">
                  {formData.cellphoneNumber}
                </Text>
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-2">Date of Birth</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300"
              >
                <Text className="text-base text-gray-900">
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

              <Text className="text-sm font-medium text-gray-700 mb-2">Gender</Text>
              <View className="space-y-2 mb-4">
                {["Male", "Female", "Other"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    className={`p-3.5 rounded-lg border ${
                      formData.gender === g
                        ? "bg-blue-600 border-blue-600"
                        : "bg-white border-gray-300"
                    }`}
                    onPress={() => handleInputChange("gender", g)}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-center font-medium ${
                        formData.gender === g ? "text-white" : "text-gray-900"
                      }`}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-2">National ID</Text>
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Enter your National ID"
                placeholderTextColor="#9CA3AF"
                value={formData.nationalId}
                onChangeText={(val) => handleInputChange("nationalId", val)}
              />
            </View>
          )}

          {/* STEP 3: Address */}
          {step === 3 && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Address</Text>
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Your street address or P.O. Box"
                placeholderTextColor="#9CA3AF"
                value={formData.address}
                onChangeText={(val) => handleInputChange("address", val)}
              />

              <Text className="text-sm font-medium text-gray-700 mb-2">Region</Text>
              <PickerContainer>
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange("region", value)}
                  items={namibianRegions}
                  placeholder={{ label: "Select a region...", value: null }}
                  value={formData.region}
                  style={pickerStyle as any}
                  Icon={() => (
                    <Feather name="chevron-down" size={20} color="#6B7280" />
                  )}
                />
              </PickerContainer>

              <Text className="text-sm font-medium text-gray-700 mb-2 mt-4">Town</Text>
              <PickerContainer>
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange("town", value)}
                  items={availableTowns}
                  placeholder={{ label: "Select a town...", value: null }}
                  value={formData.town}
                  disabled={!formData.region}
                  style={pickerStyle as any}
                  Icon={() => (
                    <Feather name="chevron-down" size={20} color="#6B7280" />
                  )}
                />
              </PickerContainer>
            </View>
          )}

          {/* STEP 4: Profile Image + Final ID check (kept minimal for patients) */}
          {step === 4 && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-3">
                Profile Image
              </Text>
              <View className="items-center mb-6">
                <TouchableOpacity
                  onPress={pickImage}
                  className="w-32 h-32 rounded-full bg-white border-2 border-gray-300 justify-center items-center overflow-hidden"
                  activeOpacity={0.7}
                >
                  {formData.profileImage ? (
                    <Image
                      source={{ uri: formData.profileImage.uri }}
                      className="w-full h-full"
                    />
                  ) : (
                    <View className="items-center">
                      <Feather name="camera" size={32} color="#9CA3AF" />
                      <Text className="text-gray-500 text-xs mt-2">
                        Tap to upload
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* National ID present from step 2; keep here if you want users to recheck */}
              <Text className="text-sm font-medium text-gray-700 mb-2">
                National ID
              </Text>
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-6 border border-gray-300 text-gray-900"
                placeholder="Enter your National ID"
                placeholderTextColor="#9CA3AF"
                value={formData.nationalId}
                onChangeText={(val) => handleInputChange("nationalId", val)}
              />

              <View className="mt-2">
                <TouchableOpacity
                  className={`py-4 rounded-lg ${
                    isLoading ? "bg-gray-400" : "bg-blue-600"
                  }`}
                  onPress={handleRegister}
                  disabled={isLoading}
                  activeOpacity={0.8}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white text-center text-base font-semibold">
                      Register
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Navigation Buttons (Steps 1-3) */}
          {step < 4 && (
            <View className="mt-8 flex-row">
              {step > 1 && !isLoading && (
                <TouchableOpacity
                  className="bg-gray-200 py-4 rounded-lg flex-1 mr-2"
                  onPress={handleBack}
                  activeOpacity={0.7}
                >
                  <Text className="text-center text-base font-semibold text-gray-900">
                    Back
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                className="bg-blue-600 py-4 rounded-lg flex-1"
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text className="text-white text-center text-base font-semibold">
                  Next
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <StatusBar backgroundColor="#F9FAFB" style="dark" />
    </SafeAreaView>
  );
};

export default RegistrationScreen;
