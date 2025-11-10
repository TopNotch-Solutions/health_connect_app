// app/(auth)/provider-registration.tsx
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import type { DocumentPickerAsset } from "expo-document-picker"; // ✅ add this
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
type PickedImage = { uri: string; name?: string; type?: string } | null; // for profile image only
type DocFile = DocumentPickerAsset | null; // ✅ what DocPickerField returns/expects

/**
 * IMPORTANT: These keys MUST match the backend multer.fields:
 * - profileImage
 * - idDocumentFront
 * - idDocumentBack
 * - primaryQualification
 * - annualQualification
 */
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
  <View className="bg-white border border-gray-200 rounded-xl px-3" style={{ height: 56, justifyContent: "center" }}>
    {children}
  </View>
);

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

    // Backend required provider fields
    hpcnaNumber: "",
    hpcnaExpiryDate: new Date(),
    yearsOfExperience: "",
    operationalZone: "",
    governingCouncil: "",
    bio: "",
    specializationsCsv: "",
  });

  // ✅ Store doc files as DocumentPickerAsset
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

  // ✅ Match DocPickerField signature
  const setDoc =
    (key: string) =>
    (file: DocFile): void =>
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
      return Alert.alert("Permission Denied", "Sorry, we need camera roll permissions to make this work!");
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
    // Required docs
    const requiredDocKeys = docConfig.filter((d) => d.required).map((d) => d.key);
    for (const key of requiredDocKeys) {
      if (!docs[key]) {
        return Alert.alert("Documents required", `Please attach: ${key}`);
      }
    }

    // Required provider fields
    if (!formData.hpcnaNumber) return Alert.alert("Error", "HPCNA number is required.");
    if (!formData.governingCouncil) return Alert.alert("Error", "Governing council is required.");
    if (!formData.bio) return Alert.alert("Error", "Professional bio is required.");
    if (!formData.yearsOfExperience) return Alert.alert("Error", "Years of experience is required.");
    if (!formData.operationalZone) return Alert.alert("Error", "Operational zone is required.");
    if (!formData.specializationsCsv.trim()) return Alert.alert("Error", "At least one specialization is required.");

    setIsSubmitting(true);

    try {
      const fd = new FormData();

      // Text fields
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

      // Backend mapping
      fd.append("role", normalizedProviderType);
      fd.append("hpcnaNumber", formData.hpcnaNumber);
      fd.append("hpcnaExpiryDate", formData.hpcnaExpiryDate.toISOString().split("T")[0]);
      fd.append("yearsOfExperience", formData.yearsOfExperience);
      fd.append("operationalZone", formData.operationalZone);
      fd.append("governingCouncil", formData.governingCouncil);
      fd.append("bio", formData.bio);

      // Specializations
      formData.specializationsCsv
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((spec) => {
          // @ts-ignore RN FormData allows duplicates
          fd.append("specializations", spec);
        });

      // Profile image (optional)
      if (formData.profileImage) {
        // @ts-ignore React Native FormData
        fd.append("profileImage", {
          uri: formData.profileImage.uri,
          name: formData.profileImage.name ?? "profile.jpg",
          type: formData.profileImage.type ?? "image/jpeg",
        });
      }

      // ✅ Documents — adapt DocumentPickerAsset shape (mimeType instead of type)
      docConfig.forEach(({ key }) => {
        const file = docs[key];
        if (file) {
          // @ts-ignore React Native FormData
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
    <SafeAreaView className="flex-1">
      <ScrollView
        contentContainerStyle={{ paddingBottom: step < 4 ? 120 : 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-6">
          <View className="mb-6">
            <Text className="text-4xl font-bold">Provider Registration</Text>
            <Text className="mt-2">
              Provider type: <Text className="font-semibold capitalize">{normalizedProviderType}</Text>
            </Text>
            <Text className="mt-2">Verified: {cellphoneNumber}</Text>
            <Text className="mt-4 text-lg">Step {step} of 4</Text>
          </View>

          {/* STEP 1 */}
          {step === 1 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Full name</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Enter your full name"
                value={formData.fullname}
                onChangeText={(val) => handleInputChange("fullname", val)}
              />
              <Text className="text-base text-text-main mb-2 font-semibold">Email</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="youremail@example.com"
                value={formData.email}
                onChangeText={(val) => handleInputChange("email", val)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text className="text-base text-text-main mb-2 font-semibold">Password</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Create a password"
                value={formData.password}
                onChangeText={(val) => handleInputChange("password", val)}
                secureTextEntry
              />
            </View>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Verified Phone Number</Text>
              <View className="w-full bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200">
                <Text className="text-base text-gray-500">{cellphoneNumber}</Text>
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">Date of Birth</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
              >
                <Text className="text-base text-text-main">{formData.dateOfBirth.toLocaleDateString()}</Text>
              </TouchableOpacity>
              {showDatePicker && <DateTimePicker value={formData.dateOfBirth} mode="date" display="default" onChange={onDateChange} />}

              <Text className="text-base text-text-main mb-2 font-semibold">Gender</Text>
              <View className="flex-row justify-around mb-4">
                {["Male", "Female", "Other"].map((g) => (
                  <TouchableOpacity
                    key={g}
                    className={`p-3 rounded-lg border flex-1 mx-1 items-center ${
                      formData.gender === g ? "bg-primary border-primary" : "bg-white border-gray-200"
                    }`}
                    onPress={() => handleInputChange("gender", g)}
                  >
                    <Text className={`${formData.gender === g ? "text-white" : "text-text-main"}`}>{g}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">National ID</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Enter your National ID"
                value={formData.nationalId}
                onChangeText={(val) => handleInputChange("nationalId", val)}
              />
            </View>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Address</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Your street address or P.O. Box"
                value={formData.address}
                onChangeText={(val) => handleInputChange("address", val)}
              />

              <Text className="text-base text-text-main mb-2 font-semibold">Region</Text>
              <PickerContainer>
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange("region", value)}
                  items={namibianRegions}
                  placeholder={{ label: "Select a region...", value: null }}
                  value={formData.region}
                  style={{ inputIOS: { color: "black" }, inputAndroid: { color: "black" } }}
                  Icon={() => <Feather name="chevron-down" size={24} color="gray" />}
                />
              </PickerContainer>

              <Text className="text-base text-text-main mb-2 font-semibold mt-4">Town</Text>
              <PickerContainer>
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange("town", value)}
                  items={availableTowns}
                  placeholder={{ label: "Select a town...", value: null }}
                  value={formData.town}
                  disabled={!formData.region}
                  style={{ inputIOS: { color: "black" }, inputAndroid: { color: "black" } }}
                  Icon={() => <Feather name="chevron-down" size={24} color="gray" />}
                />
              </PickerContainer>
            </View>
          )}

          {/* STEP 4 */}
          {step === 4 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Profile Image</Text>
              <TouchableOpacity onPress={pickImage} className="w-40 h-40 rounded-full bg-white border border-gray-200 justify-center items-center mb-6">
                {formData.profileImage ? (
                  <Image source={{ uri: formData.profileImage.uri }} className="w-full h-full rounded-full" />
                ) : (
                  <Text className="text-gray-500 text-center">Tap to select image</Text>
                )}
              </TouchableOpacity>

              <Text className="text-base text-text-main mb-3 font-semibold">Professional details</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="HPCNA number"
                value={formData.hpcnaNumber}
                onChangeText={(val) => handleInputChange("hpcnaNumber", val)}
              />

              <Text className="text-base text-text-main mb-2 font-semibold">HPCNA Expiry Date</Text>
              <TouchableOpacity
                onPress={() => setShowHpcnaDatePicker(true)}
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
              >
                <Text className="text-base text-text-main">{formData.hpcnaExpiryDate.toLocaleDateString()}</Text>
              </TouchableOpacity>
              {showHpcnaDatePicker && (
                <DateTimePicker value={formData.hpcnaExpiryDate} mode="date" display="default" onChange={onHpcnaDateChange} />
              )}

              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Years of experience"
                keyboardType="numeric"
                value={formData.yearsOfExperience}
                onChangeText={(val) => handleInputChange("yearsOfExperience", val)}
              />

              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Governing council (e.g., HPCNA)"
                value={formData.governingCouncil}
                onChangeText={(val) => handleInputChange("governingCouncil", val)}
              />

              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Specializations (comma-separated)"
                value={formData.specializationsCsv}
                onChangeText={(val) => handleInputChange("specializationsCsv", val)}
              />

              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-6 border border-gray-200"
                placeholder="Short professional bio"
                value={formData.bio}
                onChangeText={(val) => handleInputChange("bio", val)}
                multiline
              />

              <Text className="text-base text-text-main mb-3 font-semibold">Required documents</Text>
              {docConfig.map(({ key, label, required }) => (
                <DocPickerField
                  key={key}
                  label={`${label}${required ? " *" : ""}`}
                  file={docs[key] ?? null}        // ✅ correct prop
                  setFile={setDoc(key)}           // ✅ correct prop
                  // accept={['image/*','application/pdf']} // optional
                />
              ))}

              {/* Submit button */}
              <View className="mt-8">
                <TouchableOpacity
                  className={`p-4 rounded-xl ${isSubmitting ? "bg-gray-400" : "bg-primary"}`}
                  onPress={onSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-center text-lg font-semibold">Create account</Text>}
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Nav / Submit for steps 1–3 */}
          {step < 4 && (
            <View className="mt-8 flex-row">
              {step > 1 && !isSubmitting && (
                <TouchableOpacity className="bg-gray-200 p-4 rounded-xl flex-1 mr-2" onPress={handleBack}>
                  <Text className="text-center text-lg font-semibold text-text-main">Back</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity className="bg-primary p-4 rounded-xl flex-1" onPress={handleNext}>
                <Text className="text-white text-center text-lg font-semibold">Next</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ScrollView>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
}
