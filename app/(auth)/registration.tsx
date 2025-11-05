import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api';

const RegistrationScreen = () => {
  const router = useRouter();
  
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
    profileImage: null,
  });

  const [step, setStep] = useState(1);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (name, value) => {
    setFormData({ ...formData, [name]: value });
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      return Alert.alert('Permission Denied', 'Sorry, we need camera roll permissions to make this work!');
    }
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      handleInputChange('profileImage', result.assets[0]);
    }
  };

  const onDateChange = (event, selectedDate) => {
    const currentDate = selectedDate || formData.dateOfBirth;
    setShowDatePicker(Platform.OS === 'ios');
    handleInputChange('dateOfBirth', currentDate);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!formData.fullname || !formData.email || !formData.password) return Alert.alert('Error', 'Please fill in all account details.');
      if (formData.password !== formData.confirmPassword) return Alert.alert('Error', 'Passwords do not match.');
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
    const uri = formData.profileImage.uri;
    const uriParts = uri.split('.');
    const fileType = uriParts[uriParts.length - 1];
    data.append('profileImage', { // Using 'profileImage' as the key, ensure your Multer config matches this.
      uri,
      name: `profile.${fileType}`,
      type: `image/${fileType}`,
    });

    Object.keys(formData).forEach(key => {
      if (key !== 'profileImage' && key !== 'confirmPassword') {
        if (key === 'dateOfBirth') {
          data.append(key, formData[key].toISOString().split('T')[0]);
        } else {
          data.append(key, formData[key]);
        }
      }
    });

    try {
      const response = await apiClient.post('/auth/register-patient', data, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.status === 201) {
        Alert.alert('Success!', 'Patient registration completed successfully.');
        router.push('/sign-in');
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'An error occurred. Please try again.';
      Alert.alert('Registration Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light">
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}>
        <View className="p-6">
          <View className="mb-10">
            <Text className="text-4xl font-bold text-text-main">Create Account</Text>
            <Text className="text-lg text-text-main mt-2">Step {step} of 4</Text>
          </View>

          {/* Step 1 */}
          {step === 1 && (
             <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Full Name</Text>
              <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="Enter your full name" value={formData.fullname} onChangeText={(val) => handleInputChange('fullname', val)} />
              <Text className="text-base text-text-main mb-2 font-semibold">Email</Text>
              <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="youremail@example.com" value={formData.email} onChangeText={(val) => handleInputChange('email', val)} keyboardType="email-address" autoCapitalize="none" />
              <Text className="text-base text-text-main mb-2 font-semibold">Password</Text>
              <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="Create a password" value={formData.password} onChangeText={(val) => handleInputChange('password', val)} secureTextEntry />
              <Text className="text-base text-text-main mb-2 font-semibold">Confirm Password</Text>
              <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="Confirm your password" value={formData.confirmPassword} onChangeText={(val) => handleInputChange('confirmPassword', val)} secureTextEntry />
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
             <View>
                <Text className="text-base text-text-main mb-2 font-semibold">Cellphone Number</Text>
                <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="e.g., 0812345678" value={formData.cellphoneNumber} onChangeText={(val) => handleInputChange('cellphoneNumber', val)} keyboardType="phone-pad" />
                <Text className="text-base text-text-main mb-2 font-semibold">Date of Birth</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                    {/* --- THIS IS THE CORRECTED LINE --- */}
                    <Text className="w-full bg-white p-4 rounded-xl mb-4 text-gray-500">{formData.dateOfBirth.toLocaleDateString()}</Text>
                </TouchableOpacity>
                {showDatePicker && <DateTimePicker value={formData.dateOfBirth} mode="date" display="default" onChange={onDateChange} />}
                <Text className="text-base text-text-main mb-2 font-semibold">Gender</Text>
                <View className="flex-row justify-around mb-4">
                    {['Male', 'Female', 'Other'].map(g => (
                        <TouchableOpacity key={g} className={`p-3 rounded-lg border ${formData.gender === g ? 'bg-primary border-primary' : 'bg-white border-gray-200'}`} onPress={() => handleInputChange('gender', g)}>
                            <Text className={`${formData.gender === g ? 'text-white' : 'text-text-main'}`}>{g}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <View>
                <Text className="text-base text-text-main mb-2 font-semibold">Address</Text>
                <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="Your street address" value={formData.address} onChangeText={(val) => handleInputChange('address', val)} />
                <Text className="text-base text-text-main mb-2 font-semibold">Town</Text>
                <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="e.g., Windhoek" value={formData.town} onChangeText={(val) => handleInputChange('town', val)} />
                <Text className="text-base text-text-main mb-2 font-semibold">Region</Text>
                <TextInput className="w-full bg-white p-4 rounded-xl mb-4" placeholder="e.g., Khomas" value={formData.region} onChangeText={(val) => handleInputChange('region', val)} />
            </View>
          )}

          {/* Step 4 */}
          {step === 4 && (
            <View className="items-center">
                <Text className="text-base text-text-main mb-2 font-semibold">Profile Image</Text>
                <TouchableOpacity onPress={pickImage} className="w-40 h-40 rounded-full bg-white border border-gray-200 justify-center items-center mb-6">
                    {formData.profileImage ? <Image source={{ uri: formData.profileImage.uri }} className="w-full h-full rounded-full" /> : <Text className="text-gray-500 text-center">Tap to select image</Text>}
                </TouchableOpacity>
                <Text className="text-base text-text-main mb-2 font-semibold">National ID</Text>
                <TextInput className="w-full bg-white p-4 rounded-xl" placeholder="Enter your National ID" value={formData.nationalId} onChangeText={(val) => handleInputChange('nationalId', val)} />
            </View>
          )}

          {/* Navigation and Submission Buttons */}
          <View className="mt-8">
            <View className="flex-row justify-between">
              {step > 1 && !isLoading && (
                <TouchableOpacity className="bg-gray-300 p-4 rounded-xl flex-1 mr-2" onPress={handleBack}>
                  <Text className="text-center text-lg font-semibold">Back</Text>
                </TouchableOpacity>
              )}
              {step < 4 && (
                <TouchableOpacity className="bg-primary p-4 rounded-xl flex-1" onPress={handleNext}>
                  <Text className="text-white text-center text-lg font-semibold">Next</Text>
                </TouchableOpacity>
              )}
              {step === 4 && (
                 <TouchableOpacity 
                    className={`p-4 rounded-xl flex-1 ${isLoading ? 'bg-gray-400' : 'bg-secondary'}`} 
                    onPress={handleRegister}
                    disabled={isLoading}
                 >
                  {isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-center text-lg font-semibold">Register</Text>}
                </TouchableOpacity>
              )}
            </View>
            <View className="flex-row justify-center mt-8">
                <Text className="text-text-main text-base">Already have an account? </Text>
                <TouchableOpacity onPress={() => router.push('/sign-in')}>
                    <Text className="text-primary font-bold text-base">Sign In</Text>
                </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
};

export default RegistrationScreen;