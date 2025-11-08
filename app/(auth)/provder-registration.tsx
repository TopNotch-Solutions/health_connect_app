// app/(auth)/provider-registration.tsx
import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState, useEffect } from "react";
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
import apiClient from "../../lib/api";
import DocPickerField from "../components/DocPickerField";
import { namibianRegions, townsByRegion } from "../../constants/locations";

type ProviderType = "doctor" | "nurse" | "physiotherapist" | "social worker";
type PickedFile = { uri: string; name?: string; type?: string } | null;

const DOCS_BY_TYPE: Record<
  ProviderType,
  Array<{ key: string; label: string; required?: boolean }>
> = {
  doctor: [
    { key: "idFront", label: "ID – front", required: true },
    { key: "idBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Primary qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
  nurse: [
    { key: "idFront", label: "ID – front", required: true },
    { key: "idBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Nursing qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
  physiotherapist: [
    { key: "idFront", label: "ID – front", required: true },
    { key: "idBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Physiotherapy qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
  "social worker": [
    { key: "idFront", label: "ID – front", required: true },
    { key: "idBack", label: "ID – back", required: true },
    { key: "primaryQualification", label: "Social work qualification", required: true },
    { key: "annualQualification", label: "Annual practicing certificate", required: true },
  ],
};

// same container you used in the patient screen
const PickerContainer = ({ children }: { children: React.ReactNode }) => (
  <View
    className="bg-white border border-gray-200 rounded-xl px-3"
    style={{ height: 56, justifyContent: "center" }}
  >
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
  // steps
  const [step, setStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // towns for selected region
  const [availableTowns, setAvailableTowns] = useState<{ label: string; value: string }[]>([]);

  // form data in one object (like patient screen)
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
    profileImage: null as PickedFile,
    // provider-specific optional
    practiceName: "",
    licenseNumber: "",
    specialty: "",
  });

  // documents map
  const [docs, setDocs] = useState<Record<string, PickedFile | null>>({});

  // prefill phone in UI only — phone comes from params, we don't store it in formData
  useEffect(() => {
    if (formData.region) {
      setAvailableTowns(townsByRegion[formData.region] || []);
    }
  }, []);

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "region") {
      setAvailableTowns(townsByRegion[value] || []);
      setFormData((prev) => ({ ...prev, town: "" }));
    }
  };

  const setDoc = (key: string) => (file: PickedFile | null) =>
    setDocs((prev) => ({ ...prev, [key]: file }));

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.dateOfBirth;
    setShowDatePicker(Platform.OS === "ios");
    handleInputChange("dateOfBirth", currentDate);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      return Alert.alert(
        "Permission Denied",
        "Sorry, we need camera roll permissions to make this work!"
      );
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      // shape it so RN FormData likes it
      const ext = asset.uri.split(".").pop() || "jpg";
      handleInputChange("profileImage", {
        uri: asset.uri,
        name: `profile.${ext}`,
        type: `image/${ext}`,
      });
    }
  };

  const handleNext = () => {
    // stepwise validation like your patient screen
    if (step === 1) {
      if (!formData.fullname || !formData.email || !formData.password) {
        return Alert.alert("Error", "Please fill in all account details.");
      }
    }
    if (step === 2) {
      if (!formData.gender || !formData.nationalId) {
        return Alert.alert("Error", "Please select gender and add your National ID.");
      }
      // date is always there since it's a Date object
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
    // final validation: also check required docs
    const requiredDocKeys = DOCS_BY_TYPE[providerType as ProviderType]
      .filter((d) => d.required)
      .map((d) => d.key);
    for (const key of requiredDocKeys) {
      if (!docs[key]) {
        return Alert.alert("Documents required", `Please attach: ${key}`);
      }
    }

    setIsSubmitting(true);

    try {
      const fd = new FormData();

      // text fields
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
      fd.append("providerType", String(providerType));

      if (formData.practiceName) fd.append("practiceName", formData.practiceName);
      if (formData.licenseNumber) fd.append("licenseNumber", formData.licenseNumber);
      if (formData.specialty) fd.append("specialty", formData.specialty);

      // profile image (optional)
      if (formData.profileImage) {
        // @ts-ignore RN FormData
        fd.append("profileImage", {
          uri: formData.profileImage.uri,
          name: formData.profileImage.name ?? "profile.jpg",
          type: formData.profileImage.type ?? "image/jpeg",
        });
      }

      // documents
      DOCS_BY_TYPE[providerType as ProviderType].forEach(({ key }) => {
        const file = docs[key];
        if (file) {
          // @ts-ignore RN FormData
          fd.append(key, {
            uri: file.uri,
            name: file.name ?? `${key}.jpg`,
            type: file.type ?? "application/octet-stream",
          });
        }
      });

      await apiClient.post("/app/auth/register-health-provider", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

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
    <SafeAreaView className="flex-1 bg-background-light">
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="p-6 pb-10">
          <View className="mb-6">
            <Text className="text-4xl font-bold text-text-main">Provider Registration</Text>
            <Text className="text-text-main mt-2">
              Provider type:{" "}
              <Text className="font-semibold capitalize">{providerType}</Text>
            </Text>
            <Text className="text-text-main mt-2">Verified: {cellphoneNumber}</Text>
            <Text className="text-lg text-text-main mt-4">Step {step} of 4</Text>
          </View>

          {/* STEP 1: Account */}
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

          {/* STEP 2: Personal */}
          {step === 2 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">
                Verified Phone Number
              </Text>
              <View className="w-full bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200">
                <Text className="text-base text-gray-500">{cellphoneNumber}</Text>
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">Date of Birth</Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
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
                    <Text
                      className={`${
                        formData.gender === g ? "text-white" : "text-text-main"
                      }`}
                    >
                      {g}
                    </Text>
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

          {/* STEP 3: Address + Region/Town */}
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

          {/* STEP 4: Image + Professional + Docs */}
          {step === 4 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Profile Image</Text>
              <TouchableOpacity
                onPress={pickImage}
                className="w-40 h-40 rounded-full bg-white border border-gray-200 justify-center items-center mb-6"
              >
                {formData.profileImage ? (
                  <Image
                    source={{ uri: formData.profileImage.uri }}
                    className="w-full h-full rounded-full"
                  />
                ) : (
                  <Text className="text-gray-500 text-center">Tap to select image</Text>
                )}
              </TouchableOpacity>

              <Text className="text-base text-text-main mb-3 font-semibold">
                Professional (optional)
              </Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Practice name"
                value={formData.practiceName}
                onChangeText={(val) => handleInputChange("practiceName", val)}
              />
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="License/Practice number"
                value={formData.licenseNumber}
                onChangeText={(val) => handleInputChange("licenseNumber", val)}
              />
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-6 border border-gray-200"
                placeholder="Specialty"
                value={formData.specialty}
                onChangeText={(val) => handleInputChange("specialty", val)}
              />

              <Text className="text-base text-text-main mb-3 font-semibold">
                Required documents
              </Text>
              {docConfig.map(({ key, label, required }) => (
                <DocPickerField
                  setFile={setDoc(key)}
                  key={key}
                  label={`${label}${required ? " *" : ""}`}
                  value={docs[key] ?? null}
                  onChange={setDoc(key)}
                />
              ))}

            </View>
          )}

          {/* Nav / Submit */}
          <View className="mt-8 flex-row">
            {step > 1 && !isSubmitting && (
              <TouchableOpacity
                className="bg-gray-200 p-4 rounded-xl flex-1 mr-2"
                onPress={handleBack}
              >
                <Text className="text-center text-lg font-semibold text-text-main">Back</Text>
              </TouchableOpacity>
            )}

            {step < 4 && (
              <TouchableOpacity
                className="bg-primary p-4 rounded-xl flex-1"
                onPress={handleNext}
              >
                <Text className="text-white text-center text-lg font-semibold">Next</Text>
              </TouchableOpacity>
            )}

            {step === 4 && (
              <TouchableOpacity
                className={`p-4 rounded-xl flex-1 ${
                  isSubmitting ? "bg-gray-400" : "bg-secondary"
                }`}
                onPress={onSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white text-center text-lg font-semibold">
                    Create account
                  </Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
}
