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
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from "react-native";
import RNPickerSelect from "react-native-picker-select";
import { SafeAreaView } from "react-native-safe-area-context";
import { namibianRegions, townsByRegion } from "../../../constants/locations";
import apiClient from "../../../lib/api";

// --- Type Definitions ---
type DocFile = ImagePicker.ImagePickerAsset | null;

// --- Reusable UI Components ---
const UploadSquare = ({ label, file, onPick, icon }: { label: string; file: DocFile; onPick: () => void; icon: any; }) => (
    <TouchableOpacity onPress={onPick} className="bg-gray-100 border border-dashed border-gray-400 rounded-xl items-center justify-center h-32 flex-1">
        {file ? (
            <View className="items-center justify-center p-2">
                 <Feather name="check-circle" size={32} color="#28A745" />
                 <Text className="text-secondary font-semibold mt-2 text-center text-xs" numberOfLines={2}>{file.fileName}</Text>
            </View>
        ) : (
            <View className="items-center justify-center p-2">
                <Feather name={icon} size={32} color="#6C757D" />
                <Text className="text-text-main font-semibold mt-2 text-center text-sm">{label}</Text>
            </View>
        )}
    </TouchableOpacity>
);

const ReviewRow = ({ label, value }: { label: string; value?: string }) => (
    <View className="mb-3">
        <Text className="text-sm text-gray-500">{label}</Text>
        <Text className="text-base text-text-main font-semibold">{value || 'Not provided'}</Text>
    </View>
);

const ReviewFileRow = ({ label, file }: { label: string; file: DocFile }) => (
    <View className="mb-3">
        <Text className="text-sm text-gray-500">{label}</Text>
        <View className="flex-row items-center" style={{gap: 6}}>
            <Feather name={file ? "check-circle" : "x-circle"} size={16} color={file ? "#28A745" : "#EF4444"} />
            <Text className="text-base text-text-main font-semibold">{file?.fileName || 'Not attached'}</Text>
        </View>
    </View>
);

const pickerStyle = {
  inputIOS: { color: "black", fontSize: 16, paddingVertical: 12, paddingHorizontal: 10 },
  inputAndroid: { color: "black", fontSize: 16, paddingHorizontal: 10, paddingVertical: 8 },
  iconContainer: { top: 16, right: 10 },
  placeholder: { color: '#9CA3AF' },
};

export default function RegistrationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [formData, setFormData] = useState({
        fullname: "", email: "", password: "", confirmPassword: "", cellphoneNumber: "",
        dateOfBirth: new Date(), gender: "", address: "", town: "", region: "", nationalId: "",
        profileImage: null as DocFile,
        idDocumentFront: null as DocFile,
        idDocumentBack: null as DocFile,
    });

    const [step, setStep] = useState(1);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [availableTowns, setAvailableTowns] = useState<{ label: string; value: string }[]>([]);

    useEffect(() => {
        if (params.cellphoneNumber && typeof params.cellphoneNumber === 'string') {
            setFormData(prev => ({ ...prev, cellphoneNumber: params.cellphoneNumber as string }));
        }
    }, [params.cellphoneNumber]);

    const handleInputChange = (name: string, value: any) => {
        setFormData(prev => ({ ...prev, [name]: value }));
        if (name === "region") {
            setAvailableTowns(townsByRegion[value] || []);
            setFormData(prev => ({ ...prev, town: "" }));
        }
    };

    const pickImage = async (field: keyof typeof formData) => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            return Alert.alert("Permission Denied", "We need camera roll permissions to select an image.");
        }
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 1,
        });
        if (!result.canceled) {
            handleInputChange(field, result.assets[0]);
        }
    };

    const onDateChange = (_: any, selectedDate?: Date) => {
        const currentDate = selectedDate || formData.dateOfBirth;
        setShowDatePicker(false);
        handleInputChange("dateOfBirth", currentDate);
    };

    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePassword = (password: string): { valid: boolean; message: string } => {
        if (password.length < 8) return { valid: false, message: 'Password must be at least 8 characters long.' };
        if (!/[a-z]/.test(password)) return { valid: false, message: 'Password must contain at least one lowercase letter.' };
        if (!/[A-Z]/.test(password)) return { valid: false, message: 'Password must contain at least one uppercase letter.' };
        if (!/[0-9]/.test(password)) return { valid: false, message: 'Password must contain at least one number.' };
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) return { valid: false, message: 'Password must contain at least one special character.' };
        return { valid: true, message: 'Password is strong.' };
    };

    const handleNext = () => {
        if (step === 1) {
            if (!formData.fullname || !formData.email || !formData.password || !formData.confirmPassword) return Alert.alert("Missing Fields", "Please fill in all account details.");
            if (!validateEmail(formData.email)) return Alert.alert("Invalid Email", "Please enter a valid email address.");
            const passwordCheck = validatePassword(formData.password);
            if (!passwordCheck.valid) return Alert.alert("Weak Password", passwordCheck.message);
            if (formData.password !== formData.confirmPassword) return Alert.alert("Password Mismatch", "Passwords do not match.");
        }
        if (step === 2) {
             if (!formData.idDocumentFront || !formData.idDocumentBack) return Alert.alert("Documents Required", "Please upload both the front and back of your ID.");
             if (!formData.gender) return Alert.alert("Gender Required", "Please select your gender.");
             if (!formData.nationalId.trim()) return Alert.alert("National ID Required", "Please enter your National ID number.");
        }
        if (step === 3) {
            if (!formData.address || !formData.region || !formData.town) return Alert.alert("Address Required", "Please complete your address, region, and town.");
        }
        setStep(prev => prev + 1);
    };
  
    const handleBack = () => setStep(prev => prev - 1);

    // In app/(auth)/registration.tsx

const handleRegister = async () => {
    // Frontend validation remains the same
    if (!formData.profileImage) return Alert.alert("Profile Image Required", "Please upload a profile picture.");
    if (!formData.idDocumentFront) return Alert.alert("ID Document Required", "Please upload the front of your ID.");
    if (!formData.idDocumentBack) return Alert.alert("ID Document Required", "Please upload the back of your ID.");
    
    setIsLoading(true);

    const data = new FormData();

    // --- THIS IS THE CORRECTED LOGIC ---
    // We now loop through all formData properties and append them.
    (Object.keys(formData) as (keyof typeof formData)[]).forEach(key => {
      if (key === 'confirmPassword') return; // The only field to exclude

      const value = formData[key];
      
      if (value instanceof Date) {
        data.append(key, value.toISOString().split('T')[0]);
      } 
      // Check if it's a file object (has a 'uri' property)
      else if (typeof value === 'object' && value?.uri) {
        data.append(key, {
          uri: value.uri,
          name: value.fileName || `${key}.jpg`, // Use a default name if needed
          type: value.mimeType || 'image/jpeg',
        } as any);
      } 
      // Append all other string/number values
      else if (value) {
        data.append(key, String(value));
      }
    });
    // ------------------------------------

    try {
        // We only need this single API call now
        const response = await apiClient.post("/app/auth/register-patient", data, {
            headers: { "Content-Type": "multipart/form-data" },
        });

        if (response.status === 201) {
            Alert.alert("Registration Complete!", "Your account has been created successfully. Please sign in.", [{ text: 'OK', onPress: () => router.replace("/(root)/sign-in") }]);
        } else {
            // Handle cases where the server might respond with a non-201 success code
            throw new Error(response.data.message || "An unknown error occurred.");
        }
    } catch (error: any) {
        const errorMessage = error?.response?.data?.message || "An unexpected error occurred during registration.";
        Alert.alert("Registration Failed", errorMessage);
    } finally {
        setIsLoading(false);
    }
};

    return (
        <SafeAreaView className="flex-1 bg-background-light">
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                <View className="p-6">
                    <View className="flex-row items-center mb-8">
                        {/* UPDATED to 5 steps */}
                        <Text className="text-base font-semibold text-text-main mr-4">Step {step} of 5</Text>
                        <View className="flex-1 h-2 bg-gray-200 rounded-full"><View style={{ width: `${(step / 5) * 100}%` }} className="h-2 bg-primary rounded-full"/></View>
                    </View>

                    {step === 1 && (
                        <View>
                            <Text className="text-2xl font-bold text-text-main mb-6">Account Information</Text>
                            <Text className="text-base text-text-main mb-2 font-semibold">Full Name</Text>
                            <TextInput className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="Enter your full name" value={formData.fullname} onChangeText={(val) => handleInputChange("fullname", val)}/>
                            <Text className="text-base text-text-main mb-2 font-semibold">Email</Text>
                            <TextInput className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="youremail@example.com" value={formData.email} onChangeText={(val) => handleInputChange("email", val)} keyboardType="email-address" autoCapitalize="none"/>
                            <Text className="text-base text-text-main mb-2 font-semibold">Password</Text>
                            <TextInput className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="Create a password" value={formData.password} onChangeText={(val) => handleInputChange("password", val)} secureTextEntry/>
                            <Text className="text-base text-text-main mb-2 font-semibold">Confirm Password</Text>
                            <TextInput className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="Confirm your password" value={formData.confirmPassword} onChangeText={(val) => handleInputChange("confirmPassword", val)} secureTextEntry/>
                        </View>
                    )}

                    {step === 2 && (
                        <View>
                          <Text className="text-2xl font-bold text-text-main mb-6">Personal Information</Text>
                          <Text className="text-base text-text-main mb-2 font-semibold">Mobile</Text>
                          <View className="bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200"><Text className="text-base text-gray-500">{formData.cellphoneNumber}</Text></View>
                          <Text className="text-base text-text-main mb-2 font-semibold">Date of Birth</Text>
                          <TouchableOpacity onPress={() => setShowDatePicker(true)} className="bg-white p-4 rounded-xl mb-4 border border-gray-200"><Text className="text-base text-text-main">{formData.dateOfBirth.toLocaleDateString()}</Text></TouchableOpacity>
                          {showDatePicker && (<DateTimePicker value={formData.dateOfBirth} mode="date" display="default" onChange={onDateChange}/>)}
                          <Text className="text-base text-text-main mb-2 font-semibold">Gender</Text>
                          <View className="mb-4" style={{ gap: 12 }}>
                            {["Male", "Female", "Other"].map((g) => (<TouchableOpacity key={g} className={`p-4 rounded-xl border ${formData.gender === g ? "bg-primary border-primary" : "bg-white border-gray-200"}`} onPress={() => handleInputChange("gender", g)}><Text className={`text-center font-semibold ${formData.gender === g ? "text-white" : "text-text-main"}`}>{g}</Text></TouchableOpacity>))}
                          </View>
                          <Text className="text-base text-text-main mb-2 font-semibold">National ID Number</Text>
                          <TextInput className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="Enter your National ID" value={formData.nationalId} onChangeText={(val) => handleInputChange("nationalId", val)}/>
                          <Text className="text-base text-text-main mb-2 font-semibold">National ID Documents</Text>
                          <View className="flex-row mb-4" style={{ gap: 16 }}>
                              <UploadSquare label="Upload ID (Front)" file={formData.idDocumentFront} onPick={() => pickImage('idDocumentFront')} icon="file-text" />
                              <UploadSquare label="Upload ID (Back)" file={formData.idDocumentBack} onPick={() => pickImage('idDocumentBack')} icon="file-text" />
                          </View>
                        </View>
                    )}

                    {step === 3 && (
                        <View>
                            <Text className="text-2xl font-bold text-text-main mb-6">Address Information</Text>
                            <Text className="text-base text-text-main mb-2 font-semibold">Address</Text>
                            <TextInput className="bg-white p-4 rounded-xl mb-4 border border-gray-200" placeholder="Your street address or P.O. Box" value={formData.address} onChangeText={(val) => handleInputChange("address", val)}/>
                            <Text className="text-base text-text-main mb-2 font-semibold">Region</Text>
                            <View className="bg-white border border-gray-200 rounded-xl px-3 mb-4" style={{ height: 56, justifyContent: "center" }}>
                                <RNPickerSelect onValueChange={(value) => handleInputChange("region", value)} items={namibianRegions} placeholder={{ label: "Select a region...", value: null }} value={formData.region} style={pickerStyle as any} Icon={() => (<Feather name="chevron-down" size={24} color="gray" />)}/>
                            </View>
                            <Text className="text-base text-text-main mb-2 font-semibold">Town</Text>
                            <View className="bg-white border border-gray-200 rounded-xl px-3 mb-4" style={{ height: 56, justifyContent: "center" }}>
                                <RNPickerSelect onValueChange={(value) => handleInputChange("town", value)} items={availableTowns} placeholder={{ label: "Select a town...", value: null }} value={formData.town} disabled={!formData.region} style={pickerStyle as any} Icon={() => (<Feather name="chevron-down" size={24} color="gray" />)}/>
                            </View>
                        </View>
                    )}

                    {step === 4 && (
                        <View>
                            <Text className="text-2xl font-bold text-text-main mb-6">Profile Picture</Text>
                            <Text className="text-base text-text-main mb-3 font-semibold">Upload Photo</Text>
                            <View className="items-center mb-6">
                                <TouchableOpacity onPress={() => pickImage('profileImage')} className="w-32 h-32 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 justify-center items-center overflow-hidden" activeOpacity={0.7}>
                                    {formData.profileImage ? (<Image source={{ uri: formData.profileImage.uri }} className="w-full h-full"/>) : (<View className="items-center"><Feather name="camera" size={32} color="#6C757D" /><Text className="text-gray-500 text-sm mt-2 font-semibold">Tap to upload</Text></View>)}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                  {/* --- NEW STEP 5: Review & Submit --- */}
                    {step === 5 && (
                        <View>
                            <View className="items-center mb-6">
                                <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4"><Feather name="check" size={32} color="#28A745" /></View>
                                <Text className="text-2xl font-bold text-text-main mb-2">Review & Submit</Text>
                                <Text className="text-base text-gray-500 text-center">Please review your information before submitting. You can go back to make changes.</Text>
                            </View>

                            <View className="w-full bg-white p-5 rounded-xl border border-gray-200 space-y-4">
                                {/* Account Info Review */}
                                <View>
                                    <Text className="text-lg font-bold text-primary mb-2">Account</Text>
                                    <ReviewRow label="Full Name" value={formData.fullname} />
                                    <ReviewRow label="Email" value={formData.email} />
                                </View>
                                <View className="h-px bg-gray-200" />
                                
                                {/* Personal Info Review */}
                                <View>
                                    <Text className="text-lg font-bold text-primary mb-2">Personal</Text>
                                    <ReviewRow label="Mobile" value={formData.cellphoneNumber} />
                                    <ReviewRow label="Date of Birth" value={formData.dateOfBirth.toLocaleDateString()} />
                                    <ReviewRow label="Gender" value={formData.gender} />
                                    <ReviewRow label="National ID" value={formData.nationalId} />
                                    <ReviewFileRow label="ID (Front)" file={formData.idDocumentFront} />
                                    <ReviewFileRow label="ID (Back)" file={formData.idDocumentBack} />
                                </View>
                                <View className="h-px bg-gray-200" />

                                {/* Address Review */}
                                <View>
                                    <Text className="text-lg font-bold text-primary mb-2">Address</Text>
                                    <ReviewRow label="Region" value={formData.region} />
                                    <ReviewRow label="Town" value={formData.town} />
                                    <ReviewRow label="Street Address" value={formData.address} />
                                </View>
                                 <View className="h-px bg-gray-200" />

                                {/* Profile Image Review */}
                                <View>
                                    <Text className="text-lg font-bold text-primary mb-2">Profile Image</Text>
                                    <ReviewFileRow label="Profile Picture" file={formData.profileImage} />
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* --- UPDATED Sticky Buttons Logic --- */}
            <View className="absolute bottom-0 left-0 right-0 p-6 bg-background-light border-t border-t-gray-200">
                <View className="flex-row" style={{ gap: 8 }}>
                    {step > 1 && (<TouchableOpacity onPress={handleBack} className="bg-gray-200 p-4 rounded-xl flex-1"><Text className="text-center text-lg font-semibold text-text-main">Back</Text></TouchableOpacity>)}
                    {step < 5 ? (<TouchableOpacity onPress={handleNext} className="bg-primary p-4 rounded-xl flex-1"><Text className="text-white text-center text-lg font-semibold">Next</Text></TouchableOpacity>) 
                     : (<TouchableOpacity onPress={handleRegister} disabled={isLoading} className={`p-4 rounded-xl flex-1 ${isLoading ? "bg-gray-400" : "bg-primary"}`}>{isLoading ? (<ActivityIndicator color="white" />) : (<Text className="text-white text-center text-lg font-semibold">Submit Registration</Text>)}</TouchableOpacity>)}
                </View>
            </View>
            <StatusBar style="dark" />
        </SafeAreaView>
    );
};

