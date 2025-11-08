import { useRouter,useLocalSearchParams } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api'; // Import our API client

const VerifyPhoneScreen = () => {
  const router = useRouter();
  const { role = 'patient'} = useLocalSearchParams<{role?: 'patient' | 'provider'}>();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);


  // In app/(verification)/verify-phone.tsx

// In app/(verification)/verify-phone.tsx

const handleSendCode = async () => {
    // 1. Sanitize the input
    let sanitizedNumber = phoneNumber.trim();
    if (sanitizedNumber.startsWith('264')) {
      sanitizedNumber = sanitizedNumber.slice(3);
    }

    // 2. Validate the sanitized number
    if (sanitizedNumber.length !== 9) {
      return Alert.alert(
        'Invalid Number', 
        'Please enter a valid 9-digit Namibian number (e.g., 81 234 5678).'
      );
    }

    setIsLoading(true);
    // 3. Construct the final, correct phone number
    const fullPhoneNumber = `264${sanitizedNumber}`;

    // --- ADD THIS LOG ---
    console.log("Sending this phone number to the backend:", fullPhoneNumber);
    // --------------------

    try {
      const response = await apiClient.post('/auth/send-otp', {
        cellphoneNumber: fullPhoneNumber,
      });

      if (response.status === 200) {
        console.log('OTP from backend:', response.data.otp);
        Alert.alert('Code Sent', 'A verification code has been sent to your phone.');
        router.push({ 
          pathname: '/verify-otp', 
          params: { 
            phoneNumber: fullPhoneNumber,
            role,
          } 
        });
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'An error occurred. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light" edges={['top', 'bottom']}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View className="flex-1 p-6 justify-between">
          <View>
            <View className="mb-10 text-center items-center">
              <Text className="text-3xl font-bold text-text-main">Enter Your Phone Number</Text>
              <Text className="text-base text-text-main mt-3 text-center">We will send you a verification code to confirm your number.</Text>
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
    maxLength={12} // <-- Corrected to allow for "264" + 9 digits
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
              {isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-center text-lg font-semibold">Send Verification Code</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default VerifyPhoneScreen;