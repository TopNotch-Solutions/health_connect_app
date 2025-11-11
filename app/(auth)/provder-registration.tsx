import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import type { DocumentPickerAsset } from "expo-document-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState, useEffect } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { SafeAreaView } from "react-native-safe-area-context";
import apiClient from "../../lib/api";
import DocPickerField from "../components/DocPickerField";
import { namibianRegions, townsByRegion } from "../../constants/locations";

type ProviderType = "doctor" | "nurse" | "physiotherapist" | "social worker";
type PickedImage = { uri: string; name?: string; type?: string } | null;
type DocFile = DocumentPickerAsset | null;

const DOCS_BY_TYPE: Record<
  ProviderType,
  Array<{
    key: "idDocumentFront" | "idDocumentBack" | "primaryQualification" | "annualQualification";
    label: string;
    required?: boolean;
  }>
> = {
  doctor: [
    { key: "idDocumentFront", label: "ID – front", required: true },
    { key: "idDocumentBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Primary qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
  nurse: [
    { key: "idDocumentFront", label: "ID – front", required: true },
    { key: "idDocumentBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Nursing qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
  physiotherapist: [
    { key: "idDocumentFront", label: "ID – front", required: true },
    { key: "idDocumentBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Physiotherapy qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
  "social worker": [
    { key: "idDocumentFront", label: "ID – front", required: true },
    { key: "idDocumentBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Social work qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
};

const PickerContainer = ({ children }: { children: React.ReactNode }) => (
  <View className="bg-white border border-gray-300 rounded-lg px-3" style={{ height: 56, justifyContent: "center" }}>
    {children}
  </View>
);

const pickerStyle = {
  inputIOS: { color: 'black' },
  inputAndroid: { color: 'black', paddingRight: 28 },
  iconContainer: { top: 16, right: 10 },
};

export default function ProviderRegistration() {
  const router = useRouter();
  const { cellphoneNumber = "", providerType = "doctor" } =
    useLocalSearchParams<{ cellphoneNumber?: string; providerType?: string }>();

  const normalizedProviderType = (
    typeof providerType === "string" ? providerType.toLowerCase() : "doctor"
  ) as ProviderType;

  const docConfig = DOCS_BY_TYPE[normalizedProviderType] ?? DOCS_BY_TYPE["doctor"];

  const [step, setStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showHpcnaDatePicker, setShowHpcnaDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [availableTowns, setAvailableTowns] = useState<{ label: string; value: string }[]>([]);

  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    dateOfBirth: new Date(),
    gender: "",
    nationalId: "",
    region: "",
    town: "",
    address: "",
    profileImage: null as PickedImage,
    hpcnaNumber: "",
    hpcnaExpiryDate: new Date(),
    yearsOfExperience: "",
    operationalZone: "",
    governingCouncil: "",
    bio: "",
    specializationsCsv: "",
  });

  const [docs, setDocs] = useState<Record<string, DocFile>>({});

  useEffect(() => {
    if (formData.region) {
      setAvailableTowns(townsByRegion[formData.region] || []);
    }
  }, [formData.region]);

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "region") {
      setAvailableTowns(townsByRegion[value] || []);
      setFormData((prev) => ({ ...prev, town: "", operationalZone: value }));
    }
  };

  const setDoc = (key: string) => (file: DocFile): void =>
    setDocs((prev) => ({ ...prev, [key]: file }));

  const onDateChange = (_: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.dateOfBirth;
    setShowDatePicker(false);
    handleInputChange("dateOfBirth", currentDate);
  };

  const onHpcnaDateChange = (_: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.hpcnaExpiryDate;
    setShowHpcnaDatePicker(false);
    handleInputChange("hpcnaExpiryDate", currentDate);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert("Permission Denied", "We need camera roll permissions to select an image.");
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const ext = asset.uri.split(".").pop() || "jpg";
      handleInputChange("profileImage", {
        uri: asset.uri,
        name: `profile.${ext}`,
        type: `image/${ext}`,
      });
    }
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.fullname || !formData.email || !formData.password) {
        return Alert.alert("Error", "Please fill in all account details.");
      }
    }
    if (step === 2) {
      if (!formData.gender || !formData.nationalId) {
        return Alert.alert("Error", "Please select gender and add your National ID.");
      }
    }
    if (step === 3) {
      if (!formData.address || !formData.region || !formData.town) {
        return Alert.alert("Error", "Please complete your address, region, and town.");
      }
    }
    setStep((prev) => prev + 1);
  };

  const handleBack = () => setStep((prev) => prev - 1);

  const onSubmit = async () => {
    const requiredDocKeys = docConfig.filter((d) => d.required).map((d) => d.key);
    for (const key of requiredDocKeys) {
      if (!docs[key]) {
        return Alert.alert("Documents required", `Please attach: ${key}`);
      }
    }

    if (!formData.hpcnaNumber) return Alert.alert("Error", "HPCNA number is required.");
    if (!formData.governingCouncil) return Alert.alert("Error", "Governing council is required.");
    if (!formData.bio) return Alert.alert("Error", "Professional bio is required.");
    if (!formData.yearsOfExperience) return Alert.alert("Error", "Years of experience is required.");
    if (!formData.operationalZone) return Alert.alert("Error", "Operational zone is required.");
    if (!formData.specializationsCsv.trim()) return Alert.alert("Error", "At least one specialization is required.");

    setIsSubmitting(true);

    try {
      const fd = new FormData();
      fd.append("fullname", formData.fullname);
      fd.append("cellphoneNumber", String(cellphoneNumber));
      fd.append("email", formData.email);
      fd.append("password", formData.password);
      fd.append("dateOfBirth", formData.dateOfBirth.toISOString().split("T")[0]);
      fd.append("gender", formData.gender);
      fd.append("nationalId", formData.nationalId);
      fd.append("address", formData.address);
      fd.append("town", formData.town);
      fd.append("region", formData.region);
      fd.append("role", normalizedProviderType);
      fd.append("hpcnaNumber", formData.hpcnaNumber);
      fd.append("hpcnaExpiryDate", formData.hpcnaExpiryDate.toISOString().split("T")[0]);
      fd.append("yearsOfExperience", formData.yearsOfExperience);
      fd.append("operationalZone", formData.operationalZone);
      fd.append("governingCouncil", formData.governingCouncil);
      fd.append("bio", formData.bio);

      formData.specializationsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((spec) => {
          // @ts-ignore
          fd.append("specializations", spec);
        });

      if (formData.profileImage) {
        // @ts-ignore
        fd.append("profileImage", {
          uri: formData.profileImage.uri,
          name: formData.profileImage.name ?? "profile.jpg",
          type: formData.profileImage.type ?? "image/jpeg",
        });
      }

      docConfig.forEach(({ key }) => {
        const file = docs[key];
        if (file) {
          // @ts-ignore
          fd.append(key, {
            uri: file.uri,
            name: file.name ?? `${key}.pdf`,
            type: file.mimeType ?? "application/octet-stream",
          });
        }
      });

      await apiClient.post("/app/auth/register-health-provider", fd);
      Alert.alert("Success", "Provider account created. Please sign in.");
      router.replace("/(auth)/sign-in");
    } catch (error: any) {
      const msg = error?.response?.data?.message || "Registration failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <ScrollView
        contentContainerStyle={{ paddingBottom: step < 4 ? 120 : 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 pt-6">
          {/* Header */}
          <View className="mb-8">
            <Text className="text-3xl font-bold text-gray-900">Provider Registration</Text>
            <Text className="text-sm text-gray-600 mt-2">
              Provider type: <Text className="font-semibold capitalize">{normalizedProviderType}</Text>
            </Text>
            <Text className="text-sm text-gray-600">Verified: {cellphoneNumber}</Text>
            <Text className="text-base text-gray-900 font-medium mt-3">Step {step} of 4</Text>
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
            </View>
          )}

          {/* STEP 2: Personal Info */}
          {step === 2 && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">Verified Phone Number</Text>
              <View className="w-full bg-gray-100 px-4 py-3.5 rounded-lg mb-4 border border-gray-300">
                <Text className="text-base text-gray-600">{cellphoneNumber}</Text>
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-2">Date of Birth</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300"
              >
                <Text className="text-base text-gray-900">{formData.dateOfBirth.toLocaleDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && <DateTimePicker value={formData.dateOfBirth} mode="date" display="default" onChange={onDateChange} />}

              <Text className="text-sm font-medium text-gray-700 mb-2">Gender</Text>
              <View className="space-y-2 mb-4">
                {["Male", "Female", "Other"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    className={`p-3.5 rounded-lg border ${
                      formData.gender === g ? "bg-blue-600 border-blue-600" : "bg-white border-gray-300"
                    }`}
                    onPress={() => handleInputChange("gender", g)}
                    activeOpacity={0.7}
                  >
                    <Text className={`text-center font-medium ${formData.gender === g ? "text-white" : "text-gray-900"}`}>{g}</Text>
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
                  Icon={() => <Feather name="chevron-down" size={20} color="#6B7280" />}
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
                  Icon={() => <Feather name="chevron-down" size={20} color="#6B7280" />}
                />
              </PickerContainer>
            </View>
          )}

          {/* STEP 4: Professional Details & Documents */}
          {step === 4 && (
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-3">Profile Image</Text>
              <View className="items-center mb-6">
                <TouchableOpacity 
                  onPress={pickImage} 
                  className="w-32 h-32 rounded-full bg-white border-2 border-gray-300 justify-center items-center overflow-hidden"
                  activeOpacity={0.7}
                >
                  {formData.profileImage ? (
                    <Image source={{ uri: formData.profileImage.uri }} className="w-full h-full" />
                  ) : (
                    <View className="items-center">
                      <Feather name="camera" size={32} color="#9CA3AF" />
                      <Text className="text-gray-500 text-xs mt-2">Tap to upload</Text>
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              <Text className="text-base font-semibold text-gray-900 mb-4">Professional Details</Text>
              
              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="HPCNA number"
                placeholderTextColor="#9CA3AF"
                value={formData.hpcnaNumber}
                onChangeText={(val) => handleInputChange("hpcnaNumber", val)}
              />

              <Text className="text-sm font-medium text-gray-700 mb-2">HPCNA Expiry Date</Text>
              <TouchableOpacity
                onPress={() => setShowHpcnaDatePicker(true)}
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300"
              >
                <Text className="text-base text-gray-900">{formData.hpcnaExpiryDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              {showHpcnaDatePicker && (
                <DateTimePicker value={formData.hpcnaExpiryDate} mode="date" display="default" onChange={onHpcnaDateChange} />
              )}

              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Years of experience"
                placeholderTextColor="#9CA3AF"
                keyboardType="numeric"
                value={formData.yearsOfExperience}
                onChangeText={(val) => handleInputChange("yearsOfExperience", val)}
              />

              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Governing council (e.g., HPCNA)"
                placeholderTextColor="#9CA3AF"
                value={formData.governingCouncil}
                onChangeText={(val) => handleInputChange("governingCouncil", val)}
              />

              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-4 border border-gray-300 text-gray-900"
                placeholder="Specializations (comma-separated)"
                placeholderTextColor="#9CA3AF"
                value={formData.specializationsCsv}
                onChangeText={(val) => handleInputChange("specializationsCsv", val)}
              />

              <TextInput
                className="w-full bg-white px-4 py-3.5 rounded-lg mb-6 border border-gray-300 text-gray-900"
                placeholder="Short professional bio"
                placeholderTextColor="#9CA3AF"
                value={formData.bio}
                onChangeText={(val) => handleInputChange("bio", val)}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />

              <Text className="text-base font-semibold text-gray-900 mb-3">Required Documents</Text>
              {docConfig.map(({ key, label, required }) => (
                <DocPickerField
                  key={key}
                  label={`${label}${required ? " *" : ""}`}
                  file={docs[key] ?? null}
                  setFile={setDoc(key)}
                />
              ))}

              <View className="mt-6">
                <TouchableOpacity
                  className={`py-4 rounded-lg ${isSubmitting ? "bg-gray-400" : "bg-blue-600"}`}
                  onPress={onSubmit}
                  disabled={isSubmitting}
                  activeOpacity={0.8}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text className="text-white text-center text-base font-semibold">Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Navigation Buttons (Steps 1-3) */}
          {step < 4 && (
            <View className="mt-8 flex-row">
              {step > 1 && !isSubmitting && (
                <TouchableOpacity 
                  className="bg-gray-200 py-4 rounded-lg flex-1 mr-2" 
                  onPress={handleBack}
                  activeOpacity={0.7}
                >
                  <Text className="text-center text-base font-semibold text-gray-900">Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity 
                className="bg-blue-600 py-4 rounded-lg flex-1" 
                onPress={handleNext}
                activeOpacity={0.8}
              >
                <Text className="text-white text-center text-base font-semibold">Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <StatusBar backgroundColor="#F9FAFB" style="dark" />
    </SafeAreaView>
  );
}