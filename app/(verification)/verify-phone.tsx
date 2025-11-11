import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api';

const VerifyPhoneScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams(); 
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSendCode = async (): Promise<void> => {
    // Keep digits only, then strip country code if user typed it
    let sanitizedNumber = phoneNumber.replace(/\D/g, '');
    if (sanitizedNumber.startsWith('264')) sanitizedNumber = sanitizedNumber.slice(3);

    // Validate
    if (sanitizedNumber.length !== 9) {
      return Alert.alert(
        'Invalid Number',
        'Please enter a valid 9-digit Namibian number (e.g., 81 234 5678).'
      );
    }

    setIsLoading(true);

    // Construct full number
    const fullPhoneNumber = `264${sanitizedNumber}`;
    console.log('Sending this phone number to the backend:', fullPhoneNumber);

    try {
      const response = await apiClient.post('/auth/send-otp', {
        cellphoneNumber: fullPhoneNumber,
      });

      if (response.status === 200) {
        console.log('OTP from backend:', response.data?.otp);
        Alert.alert('Code Sent', 'A verification code has been sent to your phone.');
        router.push({ 
          pathname: '/verify-otp', 
          params: { 
            phoneNumber: fullPhoneNumber, 
            role: params.role // Pass the role we received
          },
        });
      }
    } catch (err: unknown) {
      let errorMessage = 'An error occurred. Please try again.';
      if (axios.isAxiosError(err)) {
        errorMessage =
          (err.response?.data as { message?: string } | undefined)?.message ??
          err.message ??
          errorMessage;
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 px-6 pt-8 justify-between">
          {/* Header Section */}
          <View>
            <View className="mb-10">
              <Text className="text-3xl font-bold text-gray-900 mb-3">
                Verify Your Phone
              </Text>
              <Text className="text-base text-gray-600 leading-6">
                We'll send you a verification code to confirm your number.
              </Text>
            </View>

            {/* Phone Input Section */}
            <View>
              <Text className="text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </Text>
              <View className="w-full bg-white rounded-lg border border-gray-300 flex-row items-center px-4 py-3.5">
                <Text className="text-xl mr-2">🇳🇦</Text>
                <Text className="text-base font-semibold text-gray-700 mr-2">
                  +264
                </Text>
                <TextInput
                  className="flex-1 text-base text-gray-900"
                  placeholder="81 234 5678"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={12}
                />
              </View>
              <Text className="text-xs text-gray-500 mt-2">
                Enter your 9-digit Namibian phone number
              </Text>
            </View>
          </View>

          {/* Bottom Button Section */}
          <View className="pb-4">
            <TouchableOpacity
              className={`w-full py-4 rounded-lg ${isLoading ? 'bg-gray-400' : 'bg-blue-600'}`}
              onPress={handleSendCode}
              disabled={isLoading}
              activeOpacity={0.8}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text className="text-white text-center text-base font-semibold">
                  Send Verification Code
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default VerifyPhoneScreen;