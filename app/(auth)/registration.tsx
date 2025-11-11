// app/(auth)/registration.tsx
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
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
} from 'react-native';
import RNPickerSelect from 'react-native-picker-select';
import { SafeAreaView } from 'react-native-safe-area-context';
import { namibianRegions, townsByRegion } from '../../constants/locations';
import apiClient from '../../lib/api';

// Container that gives the dropdown a nice bordered box
const PickerContainer = ({ children }: { children: React.ReactNode }) => (
  <View
    className="bg-white border border-gray-200 rounded-xl px-3"
    style={{ height: 56, justifyContent: 'center' }}
  >
    {children}
  </View>
);

// ✅ Option B styles: custom chevron on BOTH iOS & Android, hide native Android arrow
const pickerStyle = {
  inputIOS: { color: 'black' },
  inputAndroid: { color: 'black', paddingRight: 28 }, // space for custom chevron
  iconContainer: { top: 16, right: 10 },
};

const RegistrationScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();

  const [formData, setFormData] = useState({
    fullname: '',
    email: '',
    password: '',
    confirmPassword: '',
    cellphoneNumber: '',
    dateOfBirth: new Date(),
    gender: '',
    address: '',
    town: '',
    region: '',
    nationalId: '',
    profileImage: null as ImagePicker.ImagePickerAsset | null,
  });

  const [step, setStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [availableTowns, setAvailableTowns] = useState<{ label: string; value: string }[]>([]);

  useEffect(() => {
    if (params.cellphoneNumber && typeof params.cellphoneNumber === 'string') {
      setFormData((prev) => ({ ...prev, cellphoneNumber: params.cellphoneNumber as string }));
    }
  }, [params.cellphoneNumber]);

  const handleInputChange = (name: string, value: any) => {
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === 'region') {
      setAvailableTowns(townsByRegion[value] || []);
      setFormData((prev) => ({ ...prev, town: '' }));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      handleInputChange('profileImage', result.assets[0]);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || formData.dateOfBirth;
    setShowDatePicker(Platform.OS === 'ios');
    handleInputChange('dateOfBirth', currentDate);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.fullname || !formData.email || !formData.password)
        return Alert.alert('Error', 'Please fill in all account details.');
      if (formData.password !== formData.confirmPassword)
        return Alert.alert('Error', 'Passwords do not match.');
    }
    setStep(step + 1);
  };

  const handleBack = () => setStep(step - 1);

  const handleRegister = async () => {
    if (!formData.nationalId || !formData.profileImage) {
      return Alert.alert('Error', 'Please add your ID and profile image.');
    }

    setIsLoading(true);

    const data = new FormData();

    // profile image
    const uri = formData.profileImage.uri;
    const uriParts = uri.split('.');
    const fileType = uriParts[uriParts.length - 1];
    data.append(
      'profileImage',
      {
        uri,
        name: `profile.${fileType}`,
        type: `image/${fileType}`,
      } as any
    );

    // other fields
    Object.keys(formData).forEach((key) => {
      if (key !== 'profileImage' && key !== 'confirmPassword') {
        const value = formData[key as keyof typeof formData];
        if (key === 'dateOfBirth' && value instanceof Date) {
          data.append(key, value.toISOString().split('T')[0]);
        } else if (typeof value === 'string' || typeof value === 'number') {
          data.append(key, value.toString());
        }
      }
    });

    try {
      const response = await apiClient.post('/app/auth/register-patient', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (response.status === 201) {
        Alert.alert('Success!', 'Patient registration completed successfully.');
        router.push('/(auth)/sign-in');
      }
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'An error occurred. Please try again.';
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View className="p-6">
          <View className="mb-10">
            <Text className="text-4xl font-bold">Create Account</Text>
            <Text className="text-lg text-text-main mt-2">Step {step} of 4</Text>
          </View>

          {/* Step 1 */}
          {step === 1 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Full Name</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Enter your full name"
                value={formData.fullname}
                onChangeText={(val) => handleInputChange('fullname', val)}
              />
              <Text className="text-base text-text-main mb-2 font-semibold">Email</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="youremail@example.com"
                value={formData.email}
                onChangeText={(val) => handleInputChange('email', val)}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Text className="text-base text-text-main mb-2 font-semibold">Password</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Create a password"
                value={formData.password}
                onChangeText={(val) => handleInputChange('password', val)}
                secureTextEntry
              />
              <Text className="text-base text-text-main mb-2 font-semibold">Confirm Password</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChangeText={(val) => handleInputChange('confirmPassword', val)}
                secureTextEntry
              />
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Verified Phone Number</Text>
              <View className="w-full bg-gray-100 p-4 rounded-xl mb-4 border border-gray-200">
                <Text className="text-base text-gray-500">{formData.cellphoneNumber}</Text>
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
                {['Male', 'Female', 'Other'].map((g) => (
                  <TouchableOpacity
                    key={g}
                    className={`p-3 rounded-lg border flex-1 mx-1 items-center ${
                      formData.gender === g ? 'bg-primary border-primary' : 'bg-white border-gray-200'
                    }`}
                    onPress={() => handleInputChange('gender', g)}
                  >
                    <Text className={`${formData.gender === g ? 'text-white' : 'text-text-main'}`}>
                      {g}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Address</Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl mb-4 border border-gray-200"
                placeholder="Your street address or P.O. Box"
                value={formData.address}
                onChangeText={(val) => handleInputChange('address', val)}
              />

              <Text className="text-base text-text-main mb-2 font-semibold">Region</Text>
              <PickerContainer>
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange('region', value)}
                  items={namibianRegions}
                  placeholder={{ label: 'Select a region...', value: null }}
                  value={formData.region}
                  style={pickerStyle as any}
                  useNativeAndroidPickerStyle={false}
                  pickerProps={Platform.OS === 'android' ? { dropdownIconColor: 'transparent' } : {}}
                  Icon={() => <Feather name="chevron-down" size={22} color="gray" />}
                />
              </PickerContainer>

              <Text className="text-base text-text-main mb-2 font-semibold mt-4">Town</Text>
              <PickerContainer>
                <RNPickerSelect
                  onValueChange={(value) => handleInputChange('town', value)}
                  items={availableTowns}
                  placeholder={{ label: 'Select a town...', value: null }}
                  value={formData.town}
                  disabled={!formData.region}
                  style={pickerStyle as any}
                  useNativeAndroidPickerStyle={false}
                  pickerProps={Platform.OS === 'android' ? { dropdownIconColor: 'transparent' } : {}}
                  Icon={() => <Feather name="chevron-down" size={22} color="gray" />}
                />
              </PickerContainer>
            </View>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <View className="items-center">
              <Text className="text-base text-text-main mb-2 font-semibold self-start">
                Profile Image
              </Text>
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
              <Text className="text-base text-text-main mb-2 font-semibold self-start">
                National ID
              </Text>
              <TextInput
                className="w-full bg-white p-4 rounded-xl border border-gray-200"
                placeholder="Enter your National ID"
                value={formData.nationalId}
                onChangeText={(val) => handleInputChange('nationalId', val)}
              />
            </View>
          )}

          {/* Navigation and Submission Buttons */}
          <View className="mt-8">
            <View className="flex-row justify-between">
              {step > 1 && !isLoading && (
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
                    isLoading ? 'bg-gray-400' : 'bg-secondary'
                  }`}
                  onPress={handleRegister}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text className="text-white text-center text-lg font-semibold">
                      Register
                    </Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
};

export default RegistrationScreen;
