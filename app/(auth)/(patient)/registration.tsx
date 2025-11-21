import { Feather } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Image,
    Linking,
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
type PdfFile = DocumentPicker.DocumentPickerAsset | null;

// --- Reusable UI Components ---
const UploadSquare = ({ label, file, onPick, icon }: { label: string; file: PdfFile; onPick: () => void; icon: any; }) => (
    <TouchableOpacity onPress={onPick} className="bg-gray-100 border border-dashed border-gray-400 rounded-xl items-center justify-center h-32 flex-1">
        {file ? (
            <View className="items-center justify-center p-2">
                 <Feather name="check-circle" size={32} color="#28A745" />
                 <Text className="text-secondary font-semibold mt-2 text-center text-xs" numberOfLines={2}>{file.name}</Text>
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

const ReviewFileRow = ({ label, file }: { label: string; file: DocFile | PdfFile }) => (
    <View className="mb-3">
        <Text className="text-sm text-gray-500">{label}</Text>
        <View className="flex-row items-center" style={{gap: 6}}>
            <Feather name={file ? "check-circle" : "x-circle"} size={16} color={file ? "#28A745" : "#EF4444"} />
            <Text className="text-base text-text-main font-semibold">{(file as any)?.fileName || (file as any)?.name || 'Not attached'}</Text>
        </View>
    </View>
);

const pickerStyle = {
  inputIOS: { 
    color: "black", 
    fontSize: 16, 
    paddingVertical: 12, 
    paddingHorizontal: 10,
    paddingRight: 30,
  },
  inputAndroid: { 
    color: "black", 
    fontSize: 16, 
    paddingHorizontal: 10, 
    paddingVertical: 8,
    paddingRight: 30,
  },
  iconContainer: { 
    top: 16, 
    right: 12,
  },
  placeholder: { 
    color: '#9CA3AF',
  },
  modalViewMiddle: {
    backgroundColor: 'white',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalViewBottom: {
    backgroundColor: 'white',
  },
  chevronContainer: {
    display: 'none',
  },
};

export default function RegistrationScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const [formData, setFormData] = useState({
        fullname: "", email: "", password: "", confirmPassword: "", cellphoneNumber: "",
        dateOfBirth: new Date(), gender: "", address: "", town: "", region: "", nationalId: "",
        profileImage: null as DocFile,
        idDocumentFront: null as PdfFile,
        idDocumentBack: null as PdfFile,
    });

    const [step, setStep] = useState(1);
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [availableTowns, setAvailableTowns] = useState<{ label: string; value: string }[]>([]);
    const [acceptedTerms, setAcceptedTerms] = useState(false);
    const [errors, setErrors] = useState<{[key: string]: string}>({});
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Set up global callback for terms acceptance
    useEffect(() => {
        global.acceptTermsCallback = (accepted: boolean) => {
            setAcceptedTerms(accepted);
        };
        return () => {
            delete global.acceptTermsCallback;
        };
    }, []);

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

    const pickDocument = async (field: 'idDocumentFront' | 'idDocumentBack') => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: 'application/pdf',
                copyToCacheDirectory: true,
            });
            
            if (!result.canceled && result.assets && result.assets.length > 0) {
                handleInputChange(field, result.assets[0]);
            }
        } catch (error) {
            Alert.alert("Error", "Failed to pick document. Please try again.");
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
        const newErrors: {[key: string]: string} = {};
        
        if (step === 1) {
            if (!formData.fullname) newErrors.fullname = "Full name is required";
            if (!formData.email) newErrors.email = "Email is required";
            else if (!validateEmail(formData.email)) newErrors.email = "Please enter a valid email address";
            if (!formData.password) newErrors.password = "Password is required";
            else {
                const passwordCheck = validatePassword(formData.password);
                if (!passwordCheck.valid) newErrors.password = passwordCheck.message;
            }
            if (!formData.confirmPassword) newErrors.confirmPassword = "Please confirm your password";
            else if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords do not match";
            if (!acceptedTerms) newErrors.terms = "You must read and accept the Terms and Conditions to continue";
            
            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }
        }
        if (step === 2) {
             if (!formData.gender) newErrors.gender = "Please select your gender";
             if (!formData.nationalId.trim()) newErrors.nationalId = "National ID is required";
             else if (!/^\d{11}$/.test(formData.nationalId)) newErrors.nationalId = "National ID must be exactly 11 numeric characters";
             if (!formData.idDocumentFront) newErrors.idDocumentFront = "Please upload the front of your ID";
             if (!formData.idDocumentBack) newErrors.idDocumentBack = "Please upload the back of your ID";
             
             if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }
        }
        if (step === 3) {
            if (!formData.address) newErrors.address = "Address is required";
            if (!formData.region) newErrors.region = "Please select your region";
            if (!formData.town) newErrors.town = "Please select your town";
            
            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }
        }
        if (step === 4) {
            if (!formData.profileImage) newErrors.profileImage = "Please upload a profile picture";
            
            if (Object.keys(newErrors).length > 0) {
                setErrors(newErrors);
                return;
            }
        }
        
        setErrors({});
        setStep(prev => prev + 1);
    };
  
    const handleBack = () => {
        setErrors({});
        setStep(prev => prev - 1);
    };

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
          name: (value as any).name || (value as any).fileName || `${key}.${key.includes('idDocument') ? 'pdf' : 'jpg'}`,
          type: (value as any).mimeType || (key.includes('idDocument') ? 'application/pdf' : 'image/jpeg'),
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
        <SafeAreaView className="flex-1 bg-white">
            <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
                <View className="p-6">
                    <View className="flex-row items-center mb-8">
                        {/* UPDATED to 5 steps */}
                        <Text className="text-base font-semibold text-text-main mr-4">Step {step} of 5</Text>
                        <View className="flex-1 h-2 bg-gray-200 rounded-full"><View style={{ width: `${(step / 5) * 100}%` }} className="h-2 bg-green-600 rounded-full"/></View>
                    </View>

                    {step === 1 && (
                        <View>
                            <Text className="text-2xl font-bold text-blue-600 mb-6">Account Information</Text>
                            
                            <Text className="text-base text-gray-700 mb-2 font-semibold">Full Name</Text>
                            <TextInput className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.fullname ? 'border-red-400' : 'border-green-300'}`} placeholder="Enter your full name" value={formData.fullname} onChangeText={(val) => handleInputChange("fullname", val)}/>
                            {errors.fullname && <Text className="text-red-500 text-sm mb-3">{errors.fullname}</Text>}
                            {!errors.fullname && <View className="mb-3" />}
                            
                            <Text className="text-base text-gray-700 mb-2 font-semibold">Email</Text>
                            <TextInput className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.email ? 'border-red-400' : 'border-green-300'}`} placeholder="youremail@example.com" value={formData.email} onChangeText={(val) => handleInputChange("email", val)} keyboardType="email-address" autoCapitalize="none"/>
                            {errors.email && <Text className="text-red-500 text-sm mb-3">{errors.email}</Text>}
                            {!errors.email && <View className="mb-3" />}
                            
                            <Text className="text-base text-gray-700 mb-2 font-semibold">Password</Text>
                            <View className="relative">
                                <TextInput 
                                    className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.password ? 'border-red-400' : 'border-green-300'}`} 
                                    placeholder="Create a strong password" 
                                    value={formData.password} 
                                    onChangeText={(val) => handleInputChange("password", val)} 
                                    secureTextEntry={!showPassword}
                                />
                                <TouchableOpacity 
                                    onPress={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-4"
                                    style={{ height: 24, width: 24, justifyContent: 'center', alignItems: 'center' }}
                                >
                                    <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                                </TouchableOpacity>
                            </View>
                            {errors.password && <Text className="text-red-500 text-sm mb-3">{errors.password}</Text>}
                            {!errors.password && <View className="mb-3" />}
                            
                            <Text className="text-base text-gray-700 mb-2 font-semibold">Confirm Password</Text>
                            <View className="relative">
                                <TextInput 
                                    className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.confirmPassword ? 'border-red-400' : 'border-green-300'}`} 
                                    placeholder="Confirm your password" 
                                    value={formData.confirmPassword} 
                                    onChangeText={(val) => handleInputChange("confirmPassword", val)} 
                                    secureTextEntry={!showConfirmPassword}
                                />
                                <TouchableOpacity 
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-4 top-4"
                                    style={{ height: 24, width: 24, justifyContent: 'center', alignItems: 'center' }}
                                >
                                    <Feather name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                                </TouchableOpacity>
                            </View>
                            {errors.confirmPassword && <Text className="text-red-500 text-sm mb-3">{errors.confirmPassword}</Text>}
                            {!errors.confirmPassword && <View className="mb-3" />}
                            
                            {/* Terms and Conditions Checkbox */}
                            <TouchableOpacity 
                                onPress={() => setAcceptedTerms(!acceptedTerms)} 
                                className="flex-row items-start p-4 bg-gray-50 rounded-xl border-2 border-gray-200 mt-2"
                                activeOpacity={0.7}
                            >
                                <View className={`w-6 h-6 rounded-md mr-3 items-center justify-center border-2 ${acceptedTerms ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`}>
                                    {acceptedTerms && <Feather name="check" size={16} color="white" />}
                                </View>
                                <View className="flex-1">
                                    <Text className="text-gray-700 text-sm leading-5">
                                        I agree to the{' '}
                                        <Text 
                                            className="text-green-600 font-semibold underline" 
                                            onPress={() => router.push('/(auth)/(patient)/terms-and-conditions')}
                                        >
                                            Terms and Conditions
                                        </Text>
                                        {' '}and{' '}
                                        <Text 
                                            className="text-green-600 font-semibold underline" 
                                            onPress={() => Linking.openURL('https://healthconnect.com/privacy')}
                                        >
                                            Privacy Policy
                                        </Text>
                                    </Text>
                                </View>
                            </TouchableOpacity>
                            {errors.terms && <Text className="text-red-500 text-sm mt-2">{errors.terms}</Text>}
                        </View>
                    )}

                    {step === 2 && (
                        <View>
                          <Text className="text-2xl font-bold text-blue-600 mb-6">Personal Information</Text>
                          
                          <Text className="text-base text-gray-700 mb-2 font-semibold">Mobile</Text>
                          <View className="bg-blue-50 p-4 rounded-xl mb-4 border-2 border-blue-100"><Text className="text-base text-gray-700">{formData.cellphoneNumber}</Text></View>
                          
                          <Text className="text-base text-gray-700 mb-2 font-semibold">Date of Birth</Text>
                          <TouchableOpacity onPress={() => setShowDatePicker(true)} className="bg-white p-4 rounded-xl mb-4 border-2 border-gray-200"><Text className="text-base text-gray-700">{formData.dateOfBirth.toLocaleDateString()}</Text></TouchableOpacity>
                          {showDatePicker && (<DateTimePicker value={formData.dateOfBirth} mode="date" display="default" onChange={onDateChange}/>)}
                          
                          <Text className="text-base text-gray-700 mb-2 font-semibold">Gender</Text>
                          {errors.gender && <Text className="text-red-500 text-sm mb-2">{errors.gender}</Text>}
                          <View className="mb-4" style={{ gap: 12 }}>
                            {["Male", "Female", "Other"].map((g) => (<TouchableOpacity key={g} className={`p-4 rounded-xl border-2 ${formData.gender === g ? "bg-blue-600 border-blue-600" : "bg-white border-gray-200"}`} onPress={() => handleInputChange("gender", g)}><Text className={`text-center font-semibold ${formData.gender === g ? "text-white" : "text-gray-700"}`}>{g}</Text></TouchableOpacity>))}
                          </View>
                          
                          <Text className="text-base text-gray-700 mb-2 font-semibold">National ID Number</Text>
                          <TextInput 
                            className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.nationalId ? 'border-red-400' : 'border-green-300'}`} 
                            placeholder="Enter your 11-digit National ID" 
                            value={formData.nationalId} 
                            onChangeText={(val) => {
                              const numericOnly = val.replace(/[^0-9]/g, '');
                              if (numericOnly.length <= 11) {
                                handleInputChange("nationalId", numericOnly);
                              }
                            }}
                            keyboardType="numeric"
                            maxLength={11}
                          />
                          {errors.nationalId && <Text className="text-red-500 text-sm mb-3">{errors.nationalId}</Text>}
                          {!errors.nationalId && <View className="mb-3" />}
                          
                          <Text className="text-base text-gray-700 mb-2 font-semibold">National ID Documents</Text>
                          {(errors.idDocumentFront || errors.idDocumentBack) && <Text className="text-red-500 text-sm mb-2">{errors.idDocumentFront || errors.idDocumentBack}</Text>}
                          <View className="flex-row mb-4" style={{ gap: 16 }}>
                              <UploadSquare label="Upload ID (Front)" file={formData.idDocumentFront} onPick={() => pickDocument('idDocumentFront')} icon="file-text" />
                              <UploadSquare label="Upload ID (Back)" file={formData.idDocumentBack} onPick={() => pickDocument('idDocumentBack')} icon="file-text" />
                          </View>
                          <Text className="text-xs text-gray-500 -mt-2 mb-4">Only PDF files are accepted</Text>
                        </View>
                    )}

                    {step === 3 && (
                        <View>
                            <Text className="text-2xl font-bold text-blue-600 mb-6">Address Information</Text>
                            
                            <Text className="text-base text-gray-700 mb-2 font-semibold">Address</Text>
                            <TextInput className={`bg-white p-4 rounded-xl mb-1 border-2 ${errors.address ? 'border-red-400' : 'border-green-300'}`} placeholder="Your street address or P.O. Box" value={formData.address} onChangeText={(val) => handleInputChange("address", val)}/>
                            {errors.address && <Text className="text-red-500 text-sm mb-3">{errors.address}</Text>}
                            {!errors.address && <View className="mb-3" />}
                            
                            <Text className="text-base text-gray-700 mb-2 font-semibold">Region</Text>
                            {errors.region && <Text className="text-red-500 text-sm mb-2">{errors.region}</Text>}
                            <View className="bg-white border-2 border-green-300 rounded-xl px-3 mb-4 relative" style={{ height: 56, justifyContent: "center" }}>
                                <RNPickerSelect 
                                    onValueChange={(value) => handleInputChange("region", value)} 
                                    items={namibianRegions} 
                                    placeholder={{ label: "Select a region...", value: null }} 
                                    value={formData.region} 
                                    style={pickerStyle as any}
                                    useNativeAndroidPickerStyle={false}
                                />
                                <View className="absolute right-4 top-4" style={{ pointerEvents: 'none' }}>
                                    <Feather name="chevron-down" size={20} color="#10B981" />
                                </View>
                            </View>
                            
                            <Text className="text-base text-gray-700 mb-2 font-semibold">Town</Text>
                            {errors.town && <Text className="text-red-500 text-sm mb-2">{errors.town}</Text>}
                            <View className="bg-white border-2 border-green-300 rounded-xl px-3 mb-4 relative" style={{ height: 56, justifyContent: "center" }}>
                                <RNPickerSelect 
                                    onValueChange={(value) => handleInputChange("town", value)} 
                                    items={availableTowns} 
                                    placeholder={{ label: "Select a town...", value: null }} 
                                    value={formData.town} 
                                    disabled={!formData.region} 
                                    style={pickerStyle as any}
                                    useNativeAndroidPickerStyle={false}
                                />
                                <View className="absolute right-4 top-4" style={{ pointerEvents: 'none' }}>
                                    <Feather name="chevron-down" size={20} color={formData.region ? "#10B981" : "#D1D5DB"} />
                                </View>
                            </View>
                        </View>
                    )}

                    {step === 4 && (
                        <View>
                            <Text className="text-2xl font-bold text-blue-600 mb-6">Profile Picture</Text>
                            {errors.profileImage && <Text className="text-red-500 text-sm mb-3">{errors.profileImage}</Text>}
                            
                            <View className="items-center mb-6">
                                <TouchableOpacity onPress={() => pickImage('profileImage')} className="w-40 h-40 rounded-full bg-gray-100 border-2 border-gray-300 justify-center items-center overflow-hidden" activeOpacity={0.7}>
                                    {formData.profileImage ? (<Image source={{ uri: formData.profileImage.uri }} className="w-full h-full"/>) : (
                                        <View className="items-center">
                                            <Feather name="camera" size={32} color="#6B7280" />
                                            <Text className="text-gray-500 text-sm mt-2 font-semibold">Tap to upload</Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                  {/* --- STEP 5: Review & Submit --- */}
                    {step === 5 && (
                        <View>
                            <View className="items-center mb-6">
                                <View className="w-20 h-20 rounded-full bg-blue-100 items-center justify-center mb-4">
                                    <Feather name="check" size={36} color="#2563EB" />
                                </View>
                                <Text className="text-2xl font-bold text-blue-600 mb-2">Review & Submit</Text>
                                <Text className="text-base text-gray-600 text-center px-4">Review your information before submitting</Text>
                            </View>

                            <View className="w-full bg-white p-5 rounded-xl border-2 border-gray-200 mb-6">
                                {/* Account Info Review */}
                                <View>
                                    <Text className="text-lg font-bold text-blue-600 mb-3">Account</Text>
                                    <ReviewRow label="Full Name" value={formData.fullname} />
                                    <ReviewRow label="Email" value={formData.email} />
                                </View>
                                <View className="h-px bg-gray-200" />
                                
                                {/* Personal Info Review */}
                                <View>
                                    <Text className="text-lg font-bold text-blue-600 mb-3">Personal</Text>
                                    <ReviewRow label="Mobile" value={formData.cellphoneNumber} />
                                    <ReviewRow label="Date of Birth" value={formData.dateOfBirth.toLocaleDateString()} />
                                    <ReviewRow label="Gender" value={formData.gender} />
                                    <ReviewRow label="National ID" value={formData.nationalId} />
                                </View>
                                <View className="h-px bg-gray-200" />

                                {/* Address Review */}
                                <View>
                                    <Text className="text-lg font-bold text-blue-600 mb-3">Address</Text>
                                    <ReviewRow label="Region" value={formData.region} />
                                    <ReviewRow label="Town" value={formData.town} />
                                    <ReviewRow label="Street Address" value={formData.address} />
                                </View>
                                 <View className="h-px bg-gray-200" />

                                {/* Documents & Profile Image Review */}
                                <View>
                                    <Text className="text-lg font-bold text-blue-600 mb-3">Documents & Photo</Text>
                                    
                                    {/* Profile Picture Preview */}
                                    <View className="mb-4">
                                        <Text className="text-sm text-gray-500 mb-2">Profile Picture</Text>
                                        {formData.profileImage ? (
                                            <View className="items-center">
                                                <Image 
                                                    source={{ uri: formData.profileImage.uri }} 
                                                    className="w-32 h-32 rounded-full border-2 border-gray-200"
                                                />
                                            </View>
                                        ) : (
                                            <View className="flex-row items-center">
                                                <Feather name="x-circle" size={16} color="#EF4444" />
                                                <Text className="text-base text-gray-700 font-semibold ml-2">Not uploaded</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* ID Documents Preview */}
                                    <View className="mb-4">
                                        <Text className="text-sm text-gray-500 mb-2">National ID (Front)</Text>
                                        {formData.idDocumentFront ? (
                                            <View className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex-row items-center">
                                                <Feather name="file-text" size={24} color="#10B981" />
                                                <View className="ml-3 flex-1">
                                                    <Text className="text-sm font-semibold text-gray-900">{formData.idDocumentFront.name}</Text>
                                                    <Text className="text-xs text-gray-500">PDF Document</Text>
                                                </View>
                                                <Feather name="check-circle" size={20} color="#10B981" />
                                            </View>
                                        ) : (
                                            <View className="flex-row items-center">
                                                <Feather name="x-circle" size={16} color="#EF4444" />
                                                <Text className="text-base text-gray-700 font-semibold ml-2">Not uploaded</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View className="mb-3">
                                        <Text className="text-sm text-gray-500 mb-2">National ID (Back)</Text>
                                        {formData.idDocumentBack ? (
                                            <View className="bg-gray-50 p-4 rounded-xl border border-gray-200 flex-row items-center">
                                                <Feather name="file-text" size={24} color="#10B981" />
                                                <View className="ml-3 flex-1">
                                                    <Text className="text-sm font-semibold text-gray-900">{formData.idDocumentBack.name}</Text>
                                                    <Text className="text-xs text-gray-500">PDF Document</Text>
                                                </View>
                                                <Feather name="check-circle" size={20} color="#10B981" />
                                            </View>
                                        ) : (
                                            <View className="flex-row items-center">
                                                <Feather name="x-circle" size={16} color="#EF4444" />
                                                <Text className="text-base text-gray-700 font-semibold ml-2">Not uploaded</Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* --- Sticky Buttons --- */}
            <View className="absolute bottom-0 left-0 right-0 p-6 bg-white border-t-2 border-gray-100">
                <View className="flex-row" style={{ gap: 12 }}>
                    {step > 1 && (
                        <TouchableOpacity 
                            onPress={handleBack} 
                            className="bg-gray-100 p-4 rounded-xl flex-1 border-2 border-gray-200"
                        >
                            <Text className="text-center text-lg font-bold text-gray-700">Back</Text>
                        </TouchableOpacity>
                    )}
                    {step < 5 ? (
                        <TouchableOpacity 
                            onPress={handleNext} 
                            disabled={step === 1 && !acceptedTerms}
                            className={`p-4 rounded-xl flex-1 ${step === 1 && !acceptedTerms ? 'bg-gray-300' : 'bg-green-600'}`}
                        >
                            <Text className="text-white text-center text-lg font-bold">Next</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity 
                            onPress={handleRegister} 
                            disabled={isLoading} 
                            className={`p-4 rounded-xl flex-1 ${isLoading ? "bg-gray-300" : "bg-green-500"}`}
                        >
                            {isLoading ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text className="text-white text-center text-lg font-bold">Submit Registration</Text>
                            )}
                        </TouchableOpacity>
                    )}
                </View>
            </View>
            <StatusBar style="dark" />
        </SafeAreaView>
    );
};

