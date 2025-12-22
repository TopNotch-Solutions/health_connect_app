import { Feather } from '@expo/vector-icons';
import DateTimePicker from "@react-native-community/datetimepicker";
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { namibianRegions } from '../../../constants/locations';
import apiClient from '../../../lib/api';

// --- Type Definitions ---
type PickedImage = ImagePicker.ImagePickerAsset | null;
type DocFile = DocumentPicker.DocumentPickerAsset | null;
type Step = 1 | 2 | 3 | 4;

interface Specialization {
  _id: string;
  title: string;
  role: string;
  description?: string;
}

// --- Helper Functions for File Handling ---
const getExt = (file?: PickedImage | DocFile | null) => {
  const name = (file as any)?.name || (file as any)?.fileName || '';
  const match = /\.[A-Za-z0-9]+$/.exec(name);
  return match ? match[0].replace('.', '').toUpperCase() : '';
};

const isImageAsset = (file?: PickedImage | DocFile | null) => {
  if (!file) return false;
  const mime = (file as any)?.mimeType || (file as any)?.type || '';
  const name = (file as any)?.name || (file as any)?.fileName || '';
  return (
    (typeof mime === 'string' && mime.startsWith('image/')) ||
    /\.(png|jpe?g|gif|bmp|webp|heic)$/i.test(name)
  );
};

const openFile = async (file?: PickedImage | DocFile | null) => {
  try {
    const uri = (file as any)?.uri;
    if (!uri) return;
    await Linking.openURL(uri);
  } catch {
    Alert.alert('Cannot open file', 'Please try again or re-upload the file.');
  }
};

// --- Password validation helper ---
function validatePassword(password: string): { valid: boolean; message: string } {
  if (!password) {
    return { valid: false, message: 'Password is required.' };
  }

  const minLength = 8;
  const uppercase = /[A-Z]/;
  const lowercase = /[a-z]/;
  const number = /[0-9]/;
  const specialChar = /[!@#$%^&*(),.?":{}|<>]/;

  if (password.length < minLength) {
    return {
      valid: false,
      message: `Password must be at least ${minLength} characters long.`,
    };
  }

  if (!uppercase.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter.',
    };
  }

  if (!lowercase.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter.',
    };
  }

  if (!number.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number.',
    };
  }

  if (!specialChar.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one special character.',
    };
  }

  return { valid: true, message: 'Password is strong.' };
}

// --- Reusable UI Components ---
const UploadBox = ({
  label,
  file,
  onPick,
  icon,
  error,
}: {
  label: string;
  file: PickedImage | DocFile;
  onPick: () => void;
  icon: React.ComponentProps<typeof Feather>['name'];
  error?: string;
}) => (
  <TouchableOpacity
    onPress={onPick}
    activeOpacity={0.85}
    className={`bg-gray-100 border rounded-xl items-center justify-center h-32 flex-1 ${
      error ? 'border-red-400' : 'border-gray-200'
    }`}
  >
    {file ? (
      <View className="items-center justify-center p-2">
        <Feather name="check-circle" size={32} color="#28A745" />
        <Text
          className="text-secondary font-semibold mt-2 text-center"
          numberOfLines={2}
        >
          {(file as any)?.name || (file as any)?.fileName || 'Selected file'}
        </Text>
      </View>
    ) : (
      <View className="items-center justify-center">
        <Feather name={icon} size={32} color="#6C757D" />
        <Text className="text-text-main font-semibold mt-2 text-center">
          {label}
        </Text>
      </View>
    )}
  </TouchableOpacity>
);

const ReviewRow = ({
  label,
  value,
}: {
  label: string;
  value: string | number | undefined;
}) => (
  <View className="mb-3">
    <Text className="text-sm text-gray-500">{label}</Text>
    <Text className="text-base text-text-main font-semibold">
      {String(value ?? 'Not provided')}
    </Text>
  </View>
);

// --- Document Row Component for Review ---
const DocRow = ({
  label,
  file,
}: {
  label: string;
  file?: PickedImage | DocFile | null;
}) => {
  const image = isImageAsset(file);
  return (
    <View className="flex-row items-center py-3">
      {/* Left: thumbnail or file icon */}
      {file ? (
        image ? (
          <Image
            source={{ uri: (file as any)?.uri }}
            className="w-12 h-12 rounded-lg mr-3"
            resizeMode="cover"
          />
        ) : (
          <View className="w-12 h-12 rounded-lg mr-3 bg-gray-100 border border-gray-200 items-center justify-center overflow-hidden">
            <Feather name="file-text" size={20} color="#6C757D" />
            <Text className="text-[9px] mt-0.5 text-gray-600">
              {getExt(file) || 'FILE'}
            </Text>
          </View>
        )
      ) : (
        <View className="w-12 h-12 rounded-lg mr-3 bg-gray-100 border border-gray-200 items-center justify-center">
          <Feather name="upload" size={18} color="#9CA3AF" />
        </View>
      )}

      {/* Middle: labels */}
      <View className="flex-1">
        <Text className="text-text-main font-medium">{label}</Text>
        <Text className="text-gray-500 text-xs" numberOfLines={1}>
          {file
            ? (file as any)?.name || (file as any)?.fileName || (file as any)?.uri
            : 'Not uploaded'}
        </Text>
      </View>

      {/* Right: action */}
      {file ? (
        <TouchableOpacity onPress={() => openFile(file)}>
          <Text className="text-primary font-semibold">Open</Text>
        </TouchableOpacity>
      ) : (
        <Text className="text-gray-400 text-xs">—</Text>
      )}
    </View>
  );
};

export default function ProviderRegistrationScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expirationDate, setExpirationDate] = useState<Date>(new Date());
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Specializations from API
  const [allSpecializations, setAllSpecializations] = useState<Specialization[]>([]);
  const [filteredSpecializations, setFilteredSpecializations] = useState<Specialization[]>([]);
  const [loadingSpecializations, setLoadingSpecializations] = useState(true);

  // --- State Management for Form Data ---
  const [accountInfo, setAccountInfo] = useState({
    fullname: '',
    email: '',
    cellphoneNumber: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
    nationalId: '',
    gender: '',
  });

  const [showTermsModal, setShowTermsModal] = useState(false);

  const [documents, setDocuments] = useState({
    profileImage: null as PickedImage,
    idDocumentFront: null as DocFile,
    idDocumentBack: null as DocFile,
    finalQualification: null as DocFile,
    HPCNAQualification: null as DocFile,
    dispensingCertificateLicence: null as DocFile,
  });

  const [professionalDetails, setProfessionalDetails] = useState({
    governingCouncil: 'Health Professionals Council of Namibia',
    hpcnaNumber: '',
    bio: '',
    specializations: [] as string[],
    yearsOfExperience: '',
    operationalZone: '',
  });

  const [docErrors, setDocErrors] = useState<{
    profileImage?: string;
    finalQualification?: string;
    HPCNAQualification?: string;
  }>({});

  const [profErrors, setProfErrors] = useState<{
    specializations?: string;
    hpcnaNumber?: string;
    yearsOfExperience?: string;
    operationalZone?: string;
    bio?: string;
  }>({});

  // Pre-fill phone number from previous screen
  useEffect(() => {
    if (params.cellphoneNumber && typeof params.cellphoneNumber === 'string') {
      setAccountInfo((prev) => ({
        ...prev,
        cellphoneNumber: params.cellphoneNumber as string,
      }));
    }
  }, [params.cellphoneNumber]);

  // Set up callback for terms and conditions acceptance
  useEffect(() => {
    global.acceptProviderTermsCallback = (accepted: boolean) => {
      setAccountInfo((p) => ({ ...p, agreeToTerms: accepted }));
    };

    return () => {
      delete global.acceptProviderTermsCallback;
    };
  }, []);

  // Fetch specializations from API
  useEffect(() => {
    const fetchSpecializations = async () => {
      try {
        setLoadingSpecializations(true);
        const response = await apiClient.get('/app/specialization/all-specializations');

        // backend: res.status(200).json({ specializations })
        const list = response?.data?.specializations;
        if (Array.isArray(list)) {
          setAllSpecializations(list as Specialization[]);
        } else {
          setAllSpecializations([]);
        }
      } catch (error) {
        console.error('Error fetching specializations:', error);
        Alert.alert('Error', 'Failed to load specializations. Please try again.');
        setAllSpecializations([]);
      } finally {
        setLoadingSpecializations(false);
      }
    };

    fetchSpecializations();
  }, []);

  // Filter specializations based on provider type
  useEffect(() => {
    if (!allSpecializations.length) {
      setFilteredSpecializations([]);
      return;
    }

    if (!params.providerType) {
      setFilteredSpecializations(allSpecializations);
      return;
    }

    const providerType = String(params.providerType).toLowerCase();

    const filtered = allSpecializations.filter(
      (spec) =>
        typeof spec.role === 'string' &&
        spec.role.toLowerCase() === providerType
    );

    setFilteredSpecializations(filtered);
  }, [allSpecializations, params.providerType]);

  // --- Picker Handlers ---
  const pickImage = async (field: keyof typeof documents) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });
    if (!result.canceled)
      setDocuments((prev) => ({ ...prev, [field]: result.assets[0] }));
  };

  const pickDocument = async (field: keyof typeof documents) => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['image/*', 'application/pdf'],
    });
    if (!result.canceled && result.assets && result.assets.length)
      setDocuments((prev) => ({ ...prev, [field]: result.assets[0] as any }));
  };

  // --- date change ---
  const onExpirationDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setExpirationDate(selectedDate);
    }
  };

  // --- specialization toggle ---
  const toggleSpecialization = (specTitle: string) => {
    setProfessionalDetails((prev) => {
      const already = prev.specializations.includes(specTitle);
      return {
        ...prev,
        specializations: already
          ? prev.specializations.filter((s) => s !== specTitle)
          : [...prev.specializations, specTitle],
      };
    });
  };

  // --- Navigation Logic ---
  const handleNext = () => {
    // Step 1: basic account info + strong password rules
    if (step === 1) {
      if (!accountInfo.password || !accountInfo.confirmPassword) {
        Alert.alert('Missing password', 'Please enter and confirm your password.');
        return;
      }

      const check = validatePassword(accountInfo.password);
      if (!check.valid) {
        Alert.alert('Weak password', check.message);
        return;
      }

      if (accountInfo.password !== accountInfo.confirmPassword) {
        Alert.alert('Password mismatch', 'Password and Confirm Password do not match.');
        return;
      }
    }

    // Step 2: validate required documents before allowing Next
    if (step === 2) {
      const newDocErrors: {
        profileImage?: string;
        finalQualification?: string;
        HPCNAQualification?: string;
      } = {};

      if (!documents.profileImage) {
        newDocErrors.profileImage = 'Profile photo is required.';
      }
      if (!documents.finalQualification) {
        newDocErrors.finalQualification = 'Final qualification document is required.';
      }
      if (!documents.HPCNAQualification) {
        newDocErrors.HPCNAQualification = 'HPCNA practicing certificate is required.';
      }

      setDocErrors(newDocErrors);

      if (Object.keys(newDocErrors).length > 0) {
        // Do not advance if there are errors
        return;
      }
    } else if (step === 3) {
      // Validate professional details on step 3 before allowing Next
      const newProfErrors: {
        specializations?: string;
        hpcnaNumber?: string;
        yearsOfExperience?: string;
        operationalZone?: string;
        bio?: string;
      } = {};

      if (!professionalDetails.specializations.length) {
        newProfErrors.specializations = 'Please select at least one specialization.';
      }
      if (!professionalDetails.hpcnaNumber.trim()) {
        newProfErrors.hpcnaNumber = 'HPCNA Registration Number is required.';
      }
      if (!professionalDetails.yearsOfExperience.trim()) {
        newProfErrors.yearsOfExperience = 'Years of experience is required.';
      }
      if (!professionalDetails.operationalZone.trim()) {
        newProfErrors.operationalZone = 'Operational zone is required.';
      }
      if (!professionalDetails.bio.trim()) {
        newProfErrors.bio = 'Professional bio is required.';
      }

      setProfErrors(newProfErrors);

      if (Object.keys(newProfErrors).length > 0) {
        return;
      }
    } else {
      // Clear errors when leaving validation steps
      if (Object.keys(docErrors).length) setDocErrors({});
      if (Object.keys(profErrors).length) setProfErrors({});
    }

    setStep((prev) => Math.min(prev + 1, 4) as Step);
  };
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1) as Step);

  // --- helpers for submission ---
  const normalizeCell = (raw: string) => {
    const digits = String(raw).replace(/\D/g, '');
    if (digits.startsWith('264') && digits.length === 12) return digits;
    if (digits.startsWith('0') && digits.length === 10)
      return '264' + digits.slice(1);
    if (digits.startsWith('81') && digits.length === 9) return '264' + digits;
    return digits;
  };

  const buildFormData = () => {
    const fd = new FormData();
    const role =
      typeof params?.providerType === 'string'
        ? String(params.providerType).toLowerCase()
        : 'doctor';

    console.log('📝 Building FormData with role:', role);

    // text fields
    const pairs: Array<[string, string]> = [
      ['fullname', accountInfo.fullname],
      ['cellphoneNumber', normalizeCell(accountInfo.cellphoneNumber)],
      ['email', accountInfo.email],
      ['password', accountInfo.password],
      ['role', role],
      ['nationalId', accountInfo.nationalId || ''],
      ['gender', accountInfo.gender || ''],
      ['address', ''],
      ['governingCouncil', professionalDetails.governingCouncil],
      ['hpcnaNumber', professionalDetails.hpcnaNumber],
      ['bio', professionalDetails.bio],
      ['hpcnaExpiryDate', expirationDate.toISOString()],
      ['yearsOfExperience', professionalDetails.yearsOfExperience || ''],
      ['operationalZone', professionalDetails.operationalZone || ''],
      ['specializations', professionalDetails.specializations.join(', ')],
    ];

    pairs.forEach(([k, v]) => {
      if (v) {
        try {
          fd.append(k, v);
          console.log(`✅ Added field: ${k}`);
        } catch (err) {
          console.error(`❌ Error appending field ${k}:`, err);
        }
      }
    });

    // files
    const toFile = (asset: any, fallback: string) => {
      if (!asset) return null;
      try {
        const uri = asset.uri;
        const name =
          asset.name ||
          asset.fileName ||
          (fallback +
            (uri && uri.includes('.') ? uri.slice(uri.lastIndexOf('.')) : '.jpg'));
        const type =
          asset.mimeType ||
          asset.type ||
          (name.endsWith('.png')
            ? 'image/png'
            : name.endsWith('.pdf')
            ? 'application/pdf'
            : 'image/jpeg');
        console.log(`📄 File ${fallback}: name=${name}, type=${type}, uri=${uri}`);
        return { uri, name, type } as any;
      } catch (err) {
        console.error(`❌ Error processing file ${fallback}:`, err);
        return null;
      }
    };

    const files: Array<[any, string]> = [
      [documents.profileImage, 'profileImage'],
      [documents.idDocumentFront, 'idDocumentFront'],
      [documents.idDocumentBack, 'idDocumentBack'],
      [documents.finalQualification, 'finalQualification'],
      [documents.HPCNAQualification, 'HPCNAQualification'],
      [documents.dispensingCertificateLicence, 'dispensingCertificateLicence'],
    ];

    files.forEach(([f, key]) => {
      try {
        const file = toFile(f, key);
        if (file) {
          fd.append(key, file);
          console.log(`✅ Added file: ${key}`);
        } else {
          console.log(`⚠️ Skipped file: ${key} (not provided)`);
        }
      } catch (err) {
        console.error(`❌ Error appending file ${key}:`, err);
      }
    });

    console.log('✅ FormData building complete');
    return fd;
  };

  // --- Final Submission ---
  const handleSubmit = async () => {
    // Basic validations
    const missing: string[] = [];
    if (!accountInfo.fullname) missing.push('Full Name');
    if (!accountInfo.email) missing.push('Email');
    if (!accountInfo.cellphoneNumber) missing.push('Cellphone');
    if (!accountInfo.password) missing.push('Password');
    if (!accountInfo.confirmPassword) missing.push('Confirm Password');
    if (accountInfo.password && accountInfo.confirmPassword && accountInfo.password !== accountInfo.confirmPassword) {
      Alert.alert('Password Mismatch', 'Password and Confirm Password do not match');
      return;
    }
    if (!accountInfo.nationalId) missing.push('National ID Number');
    if (!accountInfo.gender) missing.push('Gender');
    if (!professionalDetails.hpcnaNumber)
      missing.push('HPCNA Registration Number');
    if (!professionalDetails.yearsOfExperience)
      missing.push('Years of Experience');
    if (!professionalDetails.operationalZone) missing.push('Operational Zone');
    if (!documents.idDocumentFront) missing.push('ID Front');
    if (!documents.idDocumentBack) missing.push('ID Back');
    if (!documents.profileImage) missing.push('Photo');
    if (!documents.finalQualification) missing.push('Final Qualification');
    if (!documents.HPCNAQualification)
      missing.push('HPCNA Practicing Certificate');
    // Dispensing certification is optional, do NOT treat as missing

    if (missing.length) {
      Alert.alert('Missing info', 'Please provide:\n• ' + missing.join('\n• '));
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Building form data...');
      const formData = buildFormData();

      // Get Push Token
      if (Device.isDevice) {
          try {
              const { status: existingStatus } = await Notifications.getPermissionsAsync();
              let finalStatus = existingStatus;
              if (existingStatus !== 'granted') {
                  const { status } = await Notifications.requestPermissionsAsync();
                  finalStatus = status;
              }
              if (finalStatus === 'granted') {
                  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
                  const tokenData = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
                  if (tokenData.data) {
                      formData.append('pushToken', tokenData.data);
                  }
              }
          } catch (e) {
              console.log("Error getting push token:", e);
          }
      }
      
      console.log('📤 Submitting registration...');
      const res = await apiClient.post(
        '/app/auth/register-health-provider',
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      );

      console.log('✅ Registration response:', res.status);
      
      if (res && (res.status === 201 || res.status === 200)) {
        // Show success message
        Alert.alert(
          'Registration Successful', 
          'Your account has been created successfully. Please sign in to continue.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Reset navigation stack and redirect to sign-in
                // Using replace prevents going back to registration page
                router.replace('/(root)/sign-in');
              }
            }
          ],
          { cancelable: false }
        );
      } else {
        const errorMsg = res?.data?.message ?? 'Unable to register.';
        console.error('❌ Registration error:', errorMsg);
        Alert.alert('Error', errorMsg);
      }
    } catch (e: any) {
      console.error('❌ Exception during registration:', {
        message: e?.message,
        code: e?.code,
        status: e?.response?.status,
        responseData: JSON.stringify(e?.response?.data),
        config: e?.config?.url,
        requestError: e?.request ? 'Request sent but no response' : 'No request sent',
      });
      
      // Try to extract error message from various possible locations
      let errorMsg = 'Upload failed. Please check your internet connection and try again.';
      
      if (e?.response?.data?.message) {
        errorMsg = e.response.data.message;
      } else if (e?.response?.data?.error) {
        errorMsg = e.response.data.error;
      } else if (e?.message) {
        errorMsg = e.message;
      } else if (e?.response?.statusText) {
        errorMsg = `Server error: ${e.response.statusText}`;
      }
      
      Alert.alert('Registration Error', errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
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
                className="h-2 bg-primary rounded-full "
              />
            </View>
          </View>

          {/* Step 1: Account Information */}
          {step === 1 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Account Information
              </Text>

              <Text className="text-base text-text-main mb-2 font-semibold">
                Full Name
              </Text>
              <TextInput
                value={accountInfo.fullname}
                onChangeText={(t) =>
                  setAccountInfo((p) => ({ ...p, fullname: t }))
                }
                placeholder="Enter your full name"
                className="bg-white p-4 rounded-xl mb-4 border-2 border-green-300"
              />

              <Text className="text-base text-text-main mb-2 font-semibold">
                Email
              </Text>
              <TextInput
                value={accountInfo.email}
                onChangeText={(t) =>
                  setAccountInfo((p) => ({ ...p, email: t }))
                }
                placeholder="youremail@example.com"
                className="bg-white p-4 rounded-xl mb-4 border-2 border-green-300"
                autoCapitalize="none"
                keyboardType="email-address"
              />

              <Text className="text-base text-text-main mb-2 font-semibold">
                Password
              </Text>
              <View className="relative">
                <TextInput
                  value={accountInfo.password}
                  onChangeText={(t) =>
                    setAccountInfo((p) => ({ ...p, password: t }))
                  }
                  placeholder="Create a strong password"
                  className="bg-white p-4 rounded-xl mb-4 border-2 border-green-300 pr-12"
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-4"
                  style={{ width: 24, height: 24 }}
                >
                  <Feather
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">
                Confirm Password
              </Text>
              <View className="relative">
                <TextInput
                  value={accountInfo.confirmPassword}
                  onChangeText={(t) =>
                    setAccountInfo((p) => ({ ...p, confirmPassword: t }))
                  }
                  placeholder="Confirm your password"
                  className="bg-white p-4 rounded-xl mb-4 border-2 border-green-300 pr-12"
                  secureTextEntry={!showConfirmPassword}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-4"
                  style={{ width: 24, height: 24 }}
                >
                  <Feather
                    name={showConfirmPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#6B7280"
                  />
                </TouchableOpacity>
              </View>

              <Text className="text-base text-text-main mb-2 font-semibold">
                National ID Number
              </Text>
              <TextInput
                value={accountInfo.nationalId}
                onChangeText={(t) =>
                  setAccountInfo((p) => ({ ...p, nationalId: t }))
                }
                placeholder="Enter your 11-digit National ID"
                className="bg-white p-4 rounded-xl mb-4 border-2 border-green-300"
              />

              <Text className="text-base text-text-main mb-2 font-semibold">
                Gender
              </Text>
              <View className="mb-4" style={{ gap: 12 }}>
                {['Male', 'Female'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    className={`p-4 rounded-xl border-2 ${
                      accountInfo.gender === g
                        ? 'bg-blue-600 border-blue-600'
                        : 'bg-white border-gray-200'
                    }`}
                    onPress={() =>
                      setAccountInfo((p) => ({
                        ...p,
                        gender: g,
                      }))
                    }
                    activeOpacity={0.85}
                  >
                    <Text
                      className={`text-center font-semibold ${
                        accountInfo.gender === g ? 'text-white' : 'text-gray-700'
                      }`}
                    >
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View className="flex-row" style={{ gap: 16 }}>
                <UploadBox
                  label="Upload Identification (front)"
                  file={documents.idDocumentFront}
                  onPick={() => pickDocument('idDocumentFront')}
                  icon="file-text"
                />
                <UploadBox
                  label="Upload Identification (back)"
                  file={documents.idDocumentBack}
                  onPick={() => pickDocument('idDocumentBack')}
                  icon="file-text"
                />
              </View>

              {/* Terms and Conditions Checkbox */}
              <TouchableOpacity 
                onPress={() => {
                  if (accountInfo.agreeToTerms) {
                    setAccountInfo((p) => ({ ...p, agreeToTerms: false }));
                  } else {
                    setShowTermsModal(true);
                  }
                }}
                className="flex-row items-start p-4 bg-gray-50 rounded-xl border-2 border-gray-200 mb-6 mt-4"
                activeOpacity={0.7}
              >
                <View className={`w-6 h-6 rounded-md mr-3 items-center justify-center border-2 ${accountInfo.agreeToTerms ? 'bg-green-600 border-green-600' : 'bg-white border-gray-300'}`}>
                  {accountInfo.agreeToTerms && <Feather name="check" size={16} color="white" />}
                </View>
                <View className="flex-1">
                  <Text className="text-gray-700 text-sm leading-5">
                    {accountInfo.agreeToTerms ? (
                      <Text className="text-green-600 font-semibold">
                        ✓ You have agreed to the Terms and Conditions and Privacy Policy (Tap to revoke)
                      </Text>
                    ) : (
                      <Text>
                        Tap to read and agree to the{' '}
                        <Text className="text-green-600 font-semibold underline">
                          Terms and Conditions
                        </Text>
                        {' '}and{' '}
                        <Text className="text-green-600 font-semibold underline">
                          Privacy Policy
                        </Text>
                      </Text>
                    )}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* Step 2: Documents & Qualifications */}
          {step === 2 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Documents & Qualifications
              </Text>

            <View className="mb-2">
              <UploadBox
                label="Upload Photo"
                file={documents.profileImage}
                onPick={() => pickImage('profileImage')}
                icon="camera"
                error={docErrors.profileImage}
              />
              {docErrors.profileImage ? (
                <Text className="mt-1 text-xs text-red-500">
                  {docErrors.profileImage}
                </Text>
              ) : null}
            </View>

            <View className="mb-2">
              <UploadBox
                label="Upload Final Qualification (e.g. Degree/Diploma)"
                file={documents.finalQualification}
                onPick={() => pickDocument('finalQualification')}
                icon="award"
                error={docErrors.finalQualification}
              />
              {docErrors.finalQualification ? (
                <Text className="mt-1 text-xs text-red-500">
                  {docErrors.finalQualification}
                </Text>
              ) : null}
            </View>

            <View className="mb-2">
              <UploadBox
                label="Upload HPCNA Practicing Certificate"
                file={documents.HPCNAQualification}
                onPick={() => pickDocument('HPCNAQualification')}
                icon="calendar"
                error={docErrors.HPCNAQualification}
              />
              {docErrors.HPCNAQualification ? (
                <Text className="mt-1 text-xs text-red-500">
                  {docErrors.HPCNAQualification}
                </Text>
              ) : null}
            </View>
              {params?.providerType === 'nurse' && (
                <>
                  <View className="h-3" />
                  <UploadBox
                    label="Upload Dispensing Licence (Optional)"
                    file={documents.dispensingCertificateLicence}
                    onPick={() => pickDocument('dispensingCertificateLicence')}
                    icon="file-text"
                  />
                </>
              )}
            </View>
          )}

          {/* Step 3: Professional Details */}
          {step === 3 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Professional Details
              </Text>

              <Text className="text-base text-text-main mb-2 font-semibold">
                Medical Council
              </Text>
              <View className="bg-white p-4 rounded-xl mb-4 border-2 border-green-200">
                <Text>{professionalDetails.governingCouncil}</Text>
              </View>

              {/* Specializations - Dynamic from API */}
              <Text className="text-base text-text-main mb-2 font-semibold">
                Specializations
              </Text>
              <TextInput
                value={professionalDetails.specializations.join(', ')}
                editable={false}
                placeholder="Select specialization(s) below"
                className={`bg-white p-4 rounded-xl mb-1 border-2 ${
                  profErrors.specializations ? 'border-red-400' : 'border-green-300'
                }`}
              />
              {profErrors.specializations ? (
                <Text className="text-xs text-red-500 mb-2">
                  {profErrors.specializations}
                </Text>
              ) : null}

              {loadingSpecializations ? (
                <View className="py-4">
                  <ActivityIndicator size="small" color="#007BFF" />
                  <Text className="text-center text-gray-500 mt-2">
                    Loading specializations...
                  </Text>
                </View>
              ) : filteredSpecializations.length > 0 ? (
                <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                  {filteredSpecializations.map((spec) => {
                    const selected = professionalDetails.specializations.includes(
                      spec.title
                    );
                    return (
                      <TouchableOpacity
                        key={spec._id}
                        onPress={() => toggleSpecialization(spec.title)}
                      >
                        <View
                          className={`px-3 py-1 rounded-full ${
                            selected ? 'bg-primary' : 'bg-gray-200'
                          }`}
                        >
                          <Text
                            className={`${
                              selected ? 'text-white' : 'text-text-main'
                            } font-semibold`}
                          >
                            {spec.title}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : (
                <View className="bg-gray-100 p-4 rounded-xl">
                  <Text className="text-gray-600 text-center">
                    No specializations available for{' '}
                    {params.providerType || 'this provider type'}
                  </Text>
                </View>
              )}

              <Text className="text-base text-text-main mb-2 font-semibold">
                HPCNA Registration Number
              </Text>
              <TextInput
                value={professionalDetails.hpcnaNumber}
                onChangeText={(t) =>
                  setProfessionalDetails((p) => ({ ...p, hpcnaNumber: t }))
                }
                placeholder="Enter your HPCNA registration number"
                className={`bg-white p-4 rounded-xl mb-1 border-2 ${
                  profErrors.hpcnaNumber ? 'border-red-400' : 'border-green-300'
                }`}
              />
              {profErrors.hpcnaNumber ? (
                <Text className="text-xs text-red-500 mb-2">
                  {profErrors.hpcnaNumber}
                </Text>
              ) : null}

              <Text className="text-base text-text-main mb-2 font-semibold">
                Years of Experience
              </Text>
              <TextInput
                value={professionalDetails.yearsOfExperience}
                onChangeText={(t) =>
                  setProfessionalDetails((p) => ({
                    ...p,
                    yearsOfExperience: t,
                  }))
                }
                placeholder="Enter years of experience"
                keyboardType="number-pad"
                className={`bg-white p-4 rounded-xl mb-1 border-2 ${
                  profErrors.yearsOfExperience ? 'border-red-400' : 'border-green-300'
                }`}
              />
              {profErrors.yearsOfExperience ? (
                <Text className="text-xs text-red-500 mb-2">
                  {profErrors.yearsOfExperience}
                </Text>
              ) : null}

              <Text className="text-base text-text-main mb-2 font-semibold">
                Operational Zone
              </Text>
              <View
                className={`bg-white border-2 rounded-xl px-3 mb-1 ${
                  profErrors.operationalZone ? 'border-red-400' : 'border-green-300'
                }`}
                style={{ height: 56, justifyContent: 'center' }}
              >
                <RNPickerSelect
                  onValueChange={(v) =>
                    setProfessionalDetails((p) => ({
                      ...p,
                      operationalZone: String(v || ''),
                    }))
                  }
                  value={professionalDetails.operationalZone}
                  items={namibianRegions}
                  placeholder={{ label: 'Select region…', value: '' }}
                  Icon={() => null}
                  useNativeAndroidPickerStyle={false}
                  style={{
                    inputAndroid: { fontSize: 16, color: '#111' },
                    inputIOS: { fontSize: 16, color: '#111' },
                    placeholder: { color: '#888' },
                  }}
                />
              </View>
              {profErrors.operationalZone ? (
                <Text className="text-xs text-red-500 mb-2">
                  {profErrors.operationalZone}
                </Text>
              ) : null}

              {/* Date of Expiration */}
              <Text className="text-base text-text-main mb-2 font-semibold">
                Date of Expiration
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white p-4 rounded-xl mb-4 border-2 border-green-300"
              >
                <Text className="text-base text-text-main">
                  {expirationDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={expirationDate}
                  mode="date"
                  display="default"
                  onChange={onExpirationDateChange}
                />
              )}

              {/* Bio */}
              <Text className="text-base text-text-main mb-2 font-semibold">
                Professional Bio
              </Text>
              <TextInput
                value={professionalDetails.bio}
                onChangeText={(t) =>
                  setProfessionalDetails((p) => ({ ...p, bio: t }))
                }
                placeholder="Tell us about your professional experience and expertise"
                className={`bg-white p-4 rounded-xl mb-1 border-2 h-24 ${
                  profErrors.bio ? 'border-red-400' : 'border-green-300'
                }`}
                multiline
                textAlignVertical="top"
              />
              {profErrors.bio ? (
                <Text className="text-xs text-red-500 mb-2">
                  {profErrors.bio}
                </Text>
              ) : null}
            </View>
          )}

          {/* Step 4: Review & Submit */}
          {step === 4 && (
            <View className="items-center">
              <View className="w-16 h-16 rounded-full bg-green-100 items-center justify-center mb-4">
                <Feather name="check" size={32} color="#28A745" />
              </View>
              <Text className="text-2xl font-bold text-text-main mb-2">
                Review & Submit
              </Text>
              <Text className="text-base text-gray-500 text-center mb-8">
                Please review your information before submitting.
              </Text>

              {/* Single container card */}
              <View className="w-full bg-white p-5 rounded-xl border border-gray-200">
                <ReviewRow label="Full Name" value={accountInfo.fullname} />
                <ReviewRow label="Email" value={accountInfo.email} />
                <ReviewRow
                  label="Mobile"
                  value={accountInfo.cellphoneNumber}
                />
                <ReviewRow label="National ID" value={accountInfo.nationalId} />
                <ReviewRow label="Gender" value={accountInfo.gender} />

                <View className="h-px bg-gray-200 my-3" />

                <ReviewRow
                  label="Medical Council"
                  value={professionalDetails.governingCouncil}
                />
                <ReviewRow
                  label="HPCNA Registration Number"
                  value={professionalDetails.hpcnaNumber}
                />
                <ReviewRow
                  label="Date of Expiration"
                  value={expirationDate.toLocaleDateString()}
                />
                <ReviewRow
                  label="Years of Experience"
                  value={professionalDetails.yearsOfExperience}
                />
                <ReviewRow
                  label="Operational Zone"
                  value={professionalDetails.operationalZone}
                />

                {/* Specializations on review */}
                <View className="mb-3 mt-3">
                  <Text className="text-sm text-gray-500">Specializations</Text>
                  <View className="flex-row flex-wrap mt-1" style={{ gap: 6 }}>
                    {professionalDetails.specializations.length > 0 ? (
                      professionalDetails.specializations.map((spec) => (
                        <View
                          key={spec}
                          className="bg-primary rounded-full px-3 py-1"
                        >
                          <Text className="text-white font-semibold">{spec}</Text>
                        </View>
                      ))
                    ) : (
                      <Text className="text-base text-text-main font-semibold">
                        Not provided
                      </Text>
                    )}
                  </View>
                </View>

                {/* Divider before files */}
                <View className="h-px bg-gray-200 my-4" />

                {/* Stacked file previews */}
                <Text className="text-lg font-semibold text-text-main mb-2">
                  Uploaded Files
                </Text>
                <DocRow label="Profile Photo" file={documents.profileImage} />
                <DocRow label="ID (Front)" file={documents.idDocumentFront} />
                <DocRow label="ID (Back)" file={documents.idDocumentBack} />
                <DocRow
                  label="Final Qualification"
                  file={documents.finalQualification}
                />
                <DocRow
                  label="HPCNA Practicing Certificate"
                  file={documents.HPCNAQualification}
                />
                {params?.providerType === 'nurse' && (
                  <DocRow
                    label="Dispensing Certification Licence"
                    file={documents.dispensingCertificateLicence}
                  />
                )}
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Next/Back/Submit Button */}
      <SafeAreaView edges={['bottom']} className="absolute bottom-0 left-0 right-0 border-t border-t-gray-200 bg-white">
        <View className="flex-row px-6 pt-4 pb-4" style={{ gap: 12 }}>
          {step > 1 && (
            <TouchableOpacity
              onPress={handleBack}
              disabled={isLoading}
              className="py-5 rounded-2xl flex-1 items-center justify-center border-2"
              style={{
                backgroundColor: '#F3F4F6',
                borderColor: '#D1D5DB',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.1,
                shadowRadius: 4,
                elevation: 2,
              }}
              activeOpacity={0.8}
            >
              <Text className="text-gray-700 text-xl font-semibold">Back</Text>
            </TouchableOpacity>
          )}

          {step < 4 ? (
            <TouchableOpacity
              onPress={handleNext}
              disabled={isLoading || (step === 1 && !accountInfo.agreeToTerms)}
              className="py-5 rounded-2xl flex-1 items-center justify-center"
              style={{
                backgroundColor: (isLoading || (step === 1 && !accountInfo.agreeToTerms)) ? '#9CA3AF' : '#10B981',
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              activeOpacity={0.8}
            >
              <View className="flex-row items-center">
                <Text className="text-white text-xl font-semibold mr-2">Next</Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className="py-5 rounded-2xl flex-1 items-center justify-center"
              style={{
                backgroundColor: isLoading ? '#9CA3AF' : '#10B981',
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
                elevation: 6,
              }}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <View className="flex-row items-center">
                  <Text className="text-white text-xl font-semibold mr-2">Submit</Text>
                  <Feather name="arrow-right" size={20} color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
      </SafeAreaView>

    {/* Terms and Conditions Modal */}
    <Modal
      visible={showTermsModal}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowTermsModal(false)}
    >
      <SafeAreaView className="flex-1 bg-white">
        <View className="flex-1 bg-white">
          {/* Header */}
          <View className="flex-row items-center justify-between p-6 border-b-2 border-gray-100">
            <Text className="text-2xl font-bold text-black flex-1">Terms & Conditions</Text>
            <TouchableOpacity 
              onPress={() => setShowTermsModal(false)}
              className="p-2"
            >
              <Feather name="x" size={24} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView className="flex-1 p-6">
            <Text className="text-lg font-bold text-red-600 mb-4"> Absolute Provider Liability and Indemnification Agreement</Text>
            <Text className="text-sm text-gray-700 mb-4 leading-6">
              By accepting these terms and providing services through the Health_Connect platform, I (the &quot;Provider&quot;) irrevocably agree to the following:
            </Text>

            <Text className="text-base font-bold text-gray-900 mb-3">Status and Sole Responsibility</Text>
            <Text className="text-sm text-gray-700 mb-4 leading-6">
              I confirm that my engagement with Kopano-Vertex Trading cc (trading as Health_Connect) is strictly and exclusively that of an independent contractor. I acknowledge that I am not, and shall not be deemed, an employee, agent, partner, joint venturer, or representative of Health_Connect for any purpose whatsoever.
            </Text>

            <Text className="text-base font-bold text-gray-900 mb-3">Absolute Clinical Liability</Text>
            <Text className="text-sm text-gray-700 mb-4 leading-6">
              I accept full, absolute, and unreserved personal and professional liability for any and all acts, omissions, negligence, error, or breach arising from the healthcare services I provide. This absolute liability expressly includes, but is not limited to, all medical advice, clinical diagnoses, treatment plans, prescriptions, professional conduct, patient outcomes, and adherence to professional standards, as strictly governed by the Health Professions Councils of Namibia (HPCNA).
            </Text>

            <Text className="text-base font-bold text-gray-900 mb-3">Duty to Defend and Maximum Indemnification</Text>
            <Text className="text-sm text-gray-700 mb-4 leading-6">
              I shall defend, indemnify, and hold completely harmless Kopano-Vertex Trading cc, its owners, directors, employees, successors, and assigns (collectively, the &quot;Indemnified Parties&quot;) against any and all losses, claims, demands, liabilities, lawsuits, judgments, fines, damages, expenses, and costs (including, but not limited to, reasonable legal and attorney fees, regardless of the merit of the claim) that may arise, directly or indirectly, from or relate to:
            </Text>
            <Text className="text-sm text-gray-700 mb-4 ml-3 leading-6">
              • My professional services or clinical decisions on or off the platform.{'\n'}• Any breach of my professional duties or this Agreement.{'\n'}• Any claim brought by a patient or third party regarding my medical practice.
            </Text>

            <Text className="text-base font-bold text-gray-900 mb-3">Insurance Obligation</Text>
            <Text className="text-sm text-gray-700 mb-6 leading-6">
              I confirm and warrant that I possess and shall maintain, at my sole expense, adequate and current professional liability insurance (malpractice insurance) required by the HPCNA, with coverage limits sufficient to cover my indemnification obligations under this Agreement.
            </Text>
          </ScrollView>

          {/* Footer with Accept Button */}
          <View className="p-6 border-t-2 border-gray-100 bg-white">
            <TouchableOpacity 
              onPress={() => {
                setAccountInfo((p) => ({ ...p, agreeToTerms: true }));
                setShowTermsModal(false);
              }}
              className="bg-green-600 p-4 rounded-xl"
            >
              <Text className="text-white text-center text-lg font-bold">I Accept</Text>
            </TouchableOpacity>
          </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}