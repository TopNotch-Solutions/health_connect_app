// app/(verification)/verify-phone.tsx
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
    // 1) Keep digits only, then strip country code if user typed it
    let sanitizedNumber = phoneNumber.replace(/\D/g, '');
    if (sanitizedNumber.startsWith('264')) sanitizedNumber = sanitizedNumber.slice(3);

    // 2) Validate
    if (sanitizedNumber.length !== 9) {
      return Alert.alert(
        'Invalid Number',
        'Please enter a valid 9-digit Namibian number (e.g., 81 234 5678).'
      );
    }

    setIsLoading(true);

    // 3) Construct full number
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
      // ✅ Properly narrow the unknown error (fixes: "'error' is of type 'unknown'")
      let errorMessage = 'An error occurred. Please try again.';
      if (axios.isAxiosError(err)) {
        // If your backend returns { message: string }
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
    <SafeAreaView className="flex-1" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View className="flex-1 p-6 justify-between">
          <View>
            <View className="mb-10 text-center items-center">
              <Text className="text-3xl font-bold text-text-main">Enter Your Phone Number</Text>
              <Text className="text-base text-text-main mt-3 text-center">
                We will send you a verification code to confirm your number.
              </Text>
            </View>

            <View>
              <Text className="text-base text-text-main mb-2 font-semibold">Phone Number</Text>
              <View className="w-full h-16 bg-white rounded-xl border-2 border-gray-200 flex-row items-center px-4">
                <Text className="text-2xl mr-3">🇳🇦</Text>
                <Text className="text-xl font-semibold text-text-main mr-2">+264</Text>
                <TextInput
                  className="flex-1 h-full text-xl"
                  placeholder="81 234 5678"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={12} // allow for 9 digits + spaces the user may type
                />
              </View>
            </View>
          </View>

          <View>
            <TouchableOpacity
              className={`w-full p-4 rounded-xl mt-8 ${isLoading ? 'bg-gray-400' : 'bg-primary'}`}
              onPress={handleSendCode}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text className="text-white text-center text-lg font-semibold">
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
