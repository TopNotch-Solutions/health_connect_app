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
    setShowDatePicker(false);
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
    <SafeAreaView className="flex-1">
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <View className="p-6">
          {/* Progress Bar */}
          <View className="flex-row items-center mb-8">
            <Text className="text-base font-semibold text-text-main mr-4">
              Step {step} of 4
            </Text>
            <View className="flex-1 h-2 bg-gray-200 rounded-full">
              <View
                style={{ width: `${(step / 4) * 100}%` }}
                className="h-2 bg-primary rounded-full"
              />
            </View>
          </View>

          {/* STEP 1: Account Info */}
          {step === 1 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Account Information
              </Text>
              <Text className="text-base text-text-main mb-2 font-semibold">
                Full Name
              </Text>
              <TextInput
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Enter your full name"
                value={formData.fullname}
                onChangeText={(val) => handleInputChange("fullname", val)}
              />

              <Text className="text-base text-text-main mb-2 font-semibold">
                Email
              </Text>
              <TextInput
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="youremail@example.com"
                value={formData.email}
                onChangeText={(val) => handleInputChange("email", val)}
                keyboardType="email-address"
                autoCapitalize="none"
              />

              <Text className="text-base text-text-main mb-2 font-semibold">
                Password
              </Text>
              <TextInput
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Create a password"
                value={formData.password}
                onChangeText={(val) => handleInputChange("password", val)}
                secureTextEntry
              />

              <Text className="text-base text-text-main mb-2 font-semibold">
                Confirm Password
              </Text>
              <TextInput
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChangeText={(val) => handleInputChange("confirmPassword", val)}
                secureTextEntry
              />
            </View>
          )}

          {/* STEP 2: Personal Info */}
          {step === 2 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Personal Information
              </Text>
              <Text className="text-base text-text-main mb-2 font-semibold">
                Mobile
              </Text>
              <View className="bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200">
                <Text className="text-base text-gray-500">
                  {formData.cellphoneNumber}
                </Text>
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">
                Date of Birth
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
              >
                <Text className="text-base text-text-main">
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

              <Text className="text-base text-text-main mb-2 font-semibold">
                Gender
              </Text>
              <View className="mb-4" style={{ gap: 12 }}>
                {["Male", "Female", "Other"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    className={`p-4 rounded-xl border ${
                      formData.gender === g
                        ? "bg-primary border-primary"
                        : "bg-white border-gray-200"
                    }`}
                    onPress={() => handleInputChange("gender", g)}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        formData.gender === g ? "text-white" : "text-text-main"
                      }`}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">
                National ID
              </Text>
              <TextInput
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Enter your National ID"
                value={formData.nationalId}
                onChangeText={(val) => handleInputChange("nationalId", val)}
              />
            </View>
          )}

          {/* STEP 3: Address */}
          {step === 3 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Address Information
              </Text>
              <Text className="text-base text-text-main mb-2 font-semibold">
                Address
              </Text>
              <TextInput
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Your street address or P.O. Box"
                value={formData.address}
                onChangeText={(val) => handleInputChange("address", val)}
              />

              <Text className="text-base text-text-main mb-2 font-semibold">
                Region
              </Text>
              <View
                className="bg-white border border-gray-200 rounded-xl px-3 mb-4"
                style={{ height: 56, justifyContent: "center" }}
              >
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange("region", value)}
                  items={namibianRegions}
                  placeholder={{ label: "Select a region...", value: null }}
                  value={formData.region}
                  style={pickerStyle as any}
                  Icon={() => (
                    <Feather name="chevron-down" size={24} color="gray" />
                  )}
                />
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">
                Town
              </Text>
              <View
                className="bg-white border border-gray-200 rounded-xl px-3 mb-4"
                style={{ height: 56, justifyContent: "center" }}
              >
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange("town", value)}
                  items={availableTowns}
                  placeholder={{ label: "Select a town...", value: null }}
                  value={formData.town}
                  disabled={!formData.region}
                  style={pickerStyle as any}
                  Icon={() => (
                    <Feather name="chevron-down" size={24} color="gray" />
                  )}
                />
              </View>
            </View>
          )}

          {/* STEP 4: Profile Image */}
          {step === 4 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Profile Picture
              </Text>
              <Text className="text-base text-text-main mb-3 font-semibold">
                Upload Photo
              </Text>
              <View className="items-center mb-6">
                <TouchableOpacity
                  onPress={pickImage}
                  className="w-32 h-32 rounded-full bg-gray-100 border-2 border-gray-200 justify-center items-center overflow-hidden"
                  activeOpacity={0.7}
                >
                  {formData.profileImage ? (
                    <Image
                      source={{ uri: formData.profileImage.uri }}
                      className="w-full h-full"
                    />
                  ) : (
                    <View className="items-center">
                      <Feather name="camera" size={32} color="#6C757D" />
                      <Text className="text-gray-500 text-sm mt-2 font-semibold">
                        Tap to upload
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Next/Back/Submit Button */}
      <View className="absolute bottom-0 left-0 right-0 p-6 border-t border-t-gray-200">
        <View className="flex-row" style={{ gap: 8 }}>
          {step > 1 && (
            <TouchableOpacity
              onPress={handleBack}
              className="bg-gray-200 p-4 rounded-xl flex-1"
            >
              <Text className="text-center text-lg font-semibold text-text-main">
                Back
              </Text>
            </TouchableOpacity>
          )}
          {step < 4 ? (
            <TouchableOpacity
              onPress={handleNext}
              className="bg-primary p-4 rounded-xl flex-1"
            >
              <Text className="text-white text-center text-lg font-semibold">
                Next
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleRegister}
              disabled={isLoading}
              className={`p-4 rounded-xl flex-1 ${
                isLoading ? "bg-gray-400" : "bg-primary"
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center text-lg font-semibold">
                  Register
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
      <StatusBar style="dark" />
    </SafeAreaView>
  );
};

export default RegistrationScreen;