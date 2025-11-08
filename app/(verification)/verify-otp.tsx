import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api';

const OTPScreen = () => {
  const router = useRouter();
  // --- CHANGE 1: Get the whole params object ---
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState(new Array(6).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const role = typeof params.role === 'string' && params.role === 'provider' ? 'provider' : 'patient';
  const cellphoneNumber = 
    (typeof params.phoneNumber === 'string' && params.phoneNumber) ||
    (typeof params.cellphoneNumber === 'string' && params.cellphoneNumber) ||
    '';
  const handleOtpChange = (text: string, index: number) => {
    if (isNaN(Number(text))) return;
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };
  
  const handleVerifyOtp = async () => {
    const finalOtp = otp.join('');
    if (finalOtp.length < 6) {
      return Alert.alert('Invalid Code', 'Please enter the complete 6-digit code.');
    }
    
    // --- CHANGE 2: Check the property on the params object ---
    if (!cellphoneNumber) {
      Alert.alert('Error', 'Could not verify number. Please go back and try again.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await apiClient.post('/auth/verify-otp', {
        // --- CHANGE 3: Use params.phoneNumber in the API call ---
        cellphoneNumber: params.phoneNumber,
        otp: finalOtp,
      });

      if (response.status === 200) {
        const { activeUser } = response.data;
        Alert.alert('Success', 'Phone number verified successfully!');

        if (activeUser) {
          router.replace('/(auth)/sign-in');
        } else {
          if (role === 'provider'){
            router.replace({ 
              pathname: '/(auth)/provider-type', 
              params: { 
                cellphoneNumber: params.phoneNumber 
              } 
            });
          } else {
            router.replace({ 
              pathname: '/(auth)/registration', 
              params: { 
                cellphoneNumber: params.phoneNumber 
              } 
            });
          }
        }
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'An error occurred. Please try again.';
      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light">
      <View className="flex-1 p-6 justify-center">
        <View className="text-center items-center mb-10">
          <Text className="text-3xl font-bold text-text-main">Enter Code</Text>
          {/* --- CHANGE 4: Use params.phoneNumber for display --- */}
          <Text className="text-base text-text-main mt-3 text-center">
            A 6-digit code was sent to {params.phoneNumber || 'your number'}.
          </Text>
        </View>
        <View className="flex-row justify-between w-full mb-8">
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { inputs.current[index] = ref; }}
              className="w-14 h-16 bg-white rounded-xl border border-gray-200 text-center text-2xl font-bold"
              keyboardType="number-pad"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleOtpChange(text, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
            />
          ))}
        </View>
        <TouchableOpacity
          className={`w-full p-4 rounded-xl ${isLoading ? 'bg-gray-400' : 'bg-secondary'}`}
          onPress={handleVerifyOtp}
          disabled={isLoading}
        >
          {isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-center text-lg font-semibold">Verify & Continue</Text>}
        </TouchableOpacity>
        <View className="flex-row justify-center mt-6">
          <Text className="text-text-main">Didn&apos;t receive code? </Text>
          <TouchableOpacity onPress={() => alert('Resend code logic to be implemented.')}>
            <Text className="text-primary font-bold">Resend</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OTPScreen;