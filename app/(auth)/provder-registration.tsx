import { Feather } from '@expo/vector-icons';
import DateTimePicker from "@react-native-community/datetimepicker";
import Checkbox from 'expo-checkbox';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Linking,
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';

// --- Type Definitions ---
type PickedImage = ImagePicker.ImagePickerAsset | null;
type DocFile = DocumentPicker.DocumentPickerAsset | null;
type Step = 1 | 2 | 3 | 4;

// fixed specialization options
const SPECIALIZATION_OPTIONS = [
  'General Practitioner (GP)',
  'Pediatrician',
  'Geriatrician',
  'Dermatologist',
  'Internal Medicine Specialist',
];

// --- Reusable UI Components ---
const UploadBox = ({
  label,
  file,
  onPick,
  icon,
}: {
  label: string;
  file: PickedImage | DocFile;
  onPick: () => void;
  icon: any;
}) => (
  <TouchableOpacity
    onPress={onPick}
    className="bg-gray-100 border border-gray-200 rounded-xl items-center justify-center h-32 flex-1"
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

const ReviewRow = ({ label, value }: { label: string; value?: string }) => (
  <View className="mb-3">
    <Text className="text-sm text-gray-500">{label}</Text>
    <Text className="text-base text-text-main font-semibold">
      {value || 'Not provided'}
    </Text>
  </View>
);

// ---- Helpers for previews ----
const getExt = (file?: PickedImage | DocFile | null) => {
  const name = (file as any)?.name || (file as any)?.fileName || '';
  const match = /\.[A-Za-z0-9]+$/.exec(name);
  return match ? match[0].replace('.', '').toUpperCase() : '';
};

const isImageAsset = (file?: PickedImage | DocFile | null) => {
  if (!file) return false;
  const mime =
    (file as any)?.mimeType ||
    (file as any)?.type ||
    '';
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

// --- New: vertical row preview (inside the card) ---
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
        <Text
          className="text-gray-500 text-xs"
          numberOfLines={1}
        >
          {file
            ? (file as any)?.name ||
              (file as any)?.fileName ||
              (file as any)?.uri
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

  // date of expiration
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expirationDate, setExpirationDate] = useState<Date>(new Date());

  // --- State Management for Form Data ---
  const [accountInfo, setAccountInfo] = useState({
    fullname: '',
    email: '',
    cellphoneNumber: '',
    password: '',
    agreeToTerms: false,
  });
  const [documents, setDocuments] = useState({
    profileImage: null as PickedImage,
    idDocumentFront: null as DocFile,
    idDocumentBack: null as DocFile,
    primaryQualification: null as DocFile,
    annualQualification: null as DocFile,
  });
  const [professionalDetails, setProfessionalDetails] = useState({
    governingCouncil: 'Health Professionals Council of Namibia',
    registrationCategory: '',
    hpcnaNumber: '',
    bio: '',
    // NOW an array of strings
    specializations: [] as string[],
  });

  // Pre-fill phone number from previous screen
  useEffect(() => {
    if (params.cellphoneNumber && typeof params.cellphoneNumber === 'string') {
      setAccountInfo((prev) => ({
        ...prev,
        cellphoneNumber: params.cellphoneNumber as string,
      }));
    }
  }, [params.cellphoneNumber]);

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
    if (!result.canceled)
      setDocuments((prev) => ({ ...prev, [field]: result.assets[0] }));
  };

  // --- date change ---
  const onExpirationDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false);
    if (selectedDate) {
      setExpirationDate(selectedDate);
    }
  };

  // --- specialization toggle ---
  const toggleSpecialization = (spec: string) => {
    setProfessionalDetails((prev) => {
      const already = prev.specializations.includes(spec);
      return {
        ...prev,
        specializations: already
          ? prev.specializations.filter((s) => s !== spec)
          : [...prev.specializations, spec],
      };
    });
  };

  // --- Navigation Logic ---
  const handleNext = () => setStep((prev) => Math.min(prev + 1, 4) as Step);
  const handleBack = () => setStep((prev) => Math.max(prev - 1, 1) as Step);

  // --- Final Submission ---
  const handleSubmit = async () => {
    // send:
    // accountInfo
    // documents
    // professionalDetails.specializations (array)
    // expirationDate.toISOString()
    Alert.alert('Submit', 'This will submit the form to the backend.');
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
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
              />
              <Text className="text-base text-text-main mb-2 font-semibold">
                Email
              </Text>
              <TextInput
                value={accountInfo.email}
                onChangeText={(t) =>
                  setAccountInfo((p) => ({ ...p, email: t }))
                }
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Text className="text-base text-text-main mb-2 font-semibold">
                Mobile
              </Text>
              <View className="bg-gray-100 p-4 rounded-xl mb-6 border border-gray-200">
                <Text className="text-base text-gray-500">
                  {accountInfo.cellphoneNumber}
                </Text>
              </View>
              <View className="flex-row items-center mb-6">
                <Checkbox
                  value={accountInfo.agreeToTerms}
                  onValueChange={(v) =>
                    setAccountInfo((p) => ({ ...p, agreeToTerms: v }))
                  }
                  color={accountInfo.agreeToTerms ? '#007BFF' : undefined}
                  className="w-6 h-6 rounded"
                />
                <Text className="text-base text-text-main ml-3">
                  I agree to the{' '}
                  <Text className="text-primary font-bold">
                    Subscriber Agreement
                  </Text>
                </Text>
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
            </View>
          )}

          {/* Step 2: Documents & Qualifications */}
          {step === 2 && (
            <View>
              <Text className="text-2xl font-bold text-text-main mb-6">
                Documents & Qualifications
              </Text>
              <UploadBox
                label="Upload Photo"
                file={documents.profileImage}
                onPick={() => pickImage('profileImage')}
                icon="camera"
              />
              <View className="h-3" />
              <UploadBox
                label="Upload Primary Qualification"
                file={documents.primaryQualification}
                onPick={() => pickDocument('primaryQualification')}
                icon="award"
              />
              <View className="h-3" />
              <UploadBox
                label="Upload Annual Practicing Certificate"
                file={documents.annualQualification}
                onPick={() => pickDocument('annualQualification')}
                icon="calendar"
              />
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
              <View className="bg-white p-4 rounded-xl mb-4 border border-gray-200">
                <Text>{professionalDetails.governingCouncil}</Text>
              </View>
              <Text className="text-base text-text-main mb-2 font-semibold">
                Registration Category
              </Text>
              <View
                className="bg-white border border-gray-200 rounded-xl px-3 mb-4"
                style={{ height: 56, justifyContent: 'center' }}
              >
                <RNPickerSelect
                  onValueChange={(v) =>
                    setProfessionalDetails((p) => ({
                      ...p,
                      registrationCategory: v,
                    }))
                  }
                  items={[
                    { label: 'Specialist', value: 'Specialist' },
                    { label: 'General Practitioner', value: 'General Practitioner' },
                  ]}
                  placeholder={{ label: 'Select a category...', value: null }}
                  Icon={() => (
                    <Feather name="chevron-down" size={24} color="gray" />
                  )}
                />
              </View>
              <Text className="text-base text-text-main mb-2 font-semibold">
                HPCNA Registration Number
              </Text>
              <TextInput
                value={professionalDetails.hpcnaNumber}
                onChangeText={(t) =>
                  setProfessionalDetails((p) => ({ ...p, hpcnaNumber: t }))
                }
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
              />

              {/* Date of Expiration */}
              <Text className="text-base text-text-main mb-2 font-semibold">
                Date of Expiration
              </Text>
              <TouchableOpacity
                onPress={() => setShowDatePicker(true)}
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200"
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
                className="bg-white p-4 rounded-xl mb-4 border border-gray-200 h-24"
                multiline
                textAlignVertical="top"
              />

              {/* Specializations: read-only text field + chips */}
              <Text className="text-base text-text-main mb-2 font-semibold">
                Specializations
              </Text>
              <TextInput
                value={professionalDetails.specializations.join(', ')}
                editable={false}
                placeholder="Select specialization(s) below"
                className="bg-white p-4 rounded-xl mb-3 border border-gray-200"
              />
              <View className="flex-row flex-wrap" style={{ gap: 8 }}>
                {SPECIALIZATION_OPTIONS.map((spec) => {
                  const selected = professionalDetails.specializations.includes(
                    spec
                  );
                  return (
                    <TouchableOpacity
                      key={spec}
                      onPress={() => toggleSpecialization(spec)}
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
                          {spec}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
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
                <ReviewRow label="Mobile" value={accountInfo.cellphoneNumber} />

                <View className="h-px bg-gray-200 my-3" />

                <ReviewRow
                  label="Medical Council"
                  value={professionalDetails.governingCouncil}
                />
                <ReviewRow
                  label="Registration Category"
                  value={professionalDetails.registrationCategory}
                />
                <ReviewRow
                  label="HPCNA Registration Number"
                  value={professionalDetails.hpcnaNumber}
                />
                <ReviewRow
                  label="Date of Expiration"
                  value={expirationDate.toLocaleDateString()}
                />

                {/* Specializations on review */}
                <View className="mb-3 mt-3">
                  <Text className="text-sm text-gray-500">
                    Specializations
                  </Text>
                  <View className="flex-row flex-wrap mt-1" style={{ gap: 6 }}>
                    {professionalDetails.specializations.length > 0 ? (
                      professionalDetails.specializations.map((spec) => (
                        <View
                          key={spec}
                          className="bg-primary rounded-full px-3 py-1"
                        >
                          <Text className="text-white font-semibold">
                            {spec}
                          </Text>
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

                {/* Stacked file previews inside this same container */}
                <Text className="text-lg font-semibold text-text-main mb-2">
                  Uploaded Files
                </Text>

                <DocRow label="Profile Photo" file={documents.profileImage} />
                <DocRow label="ID (Front)" file={documents.idDocumentFront} />
                <DocRow label="ID (Back)" file={documents.idDocumentBack} />
                <DocRow
                  label="Primary Qualification"
                  file={documents.primaryQualification}
                />
                <DocRow
                  label="Annual Practicing Certificate"
                  file={documents.annualQualification}
                />
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Sticky Next/Back/Submit Button */}
      <View className="absolute bottom-0 left-0 right-0 p-6 border-t border-t-gray-200 bg-white">
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
              onPress={handleSubmit}
              disabled={isLoading}
              className={`p-4 rounded-xl flex-1 ${
                isLoading ? 'bg-gray-400' : 'bg-primary'
              }`}
            >
              {isLoading ? (
                <ActivityIndicator color="white" />
              ) : (
                <Text className="text-white text-center text-lg font-semibold">
                  Submit
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
