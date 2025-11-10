import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api';

const OTPScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Normalize params
  const role: 'provider' | 'patient' =
    typeof params.role === 'string' && params.role === 'provider' ? 'provider' : 'patient';

  const cellphoneNumber =
    (typeof params.cellphoneNumber === 'string' && params.cellphoneNumber) ||
    (typeof params.phoneNumber === 'string' && params.phoneNumber) ||
    '';

  const handleOtpChange = (text: string, index: number) => {
    if (isNaN(Number(text))) return;
    const next = [...otp];
    next[index] = text;
    setOtp(next);
    if (text && index < 5) inputs.current[index + 1]?.focus();
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
    if (!cellphoneNumber) {
      return Alert.alert('Error', 'Missing phone number. Please go back and try again.');
    }

    setIsLoading(true);
    try {
      // Forgot password flow: params.flow === 'resetPassword'
      if (typeof params.flow === 'string' && params.flow === 'resetPassword') {
        const response = await apiClient.post('/app/auth/forgot-password-verify-otp', {
          cellphoneNumber,
          otp: finalOtp,
        });

        if (response.status === 200 && response.data?.userId) {
          Alert.alert('Success', 'OTP verified. Please set your new password.');
          router.replace({
            pathname: '/(auth)/reset-password',
            params: { userId: String(response.data.userId) },
          });
        } else {
          const msg = response.data?.message || 'Verification failed.';
          throw new Error(msg);
        }
      } else {
        // Normal verify flow (new/existing user)
        const response = await apiClient.post('/auth/verify-otp', {
          cellphoneNumber,
          otp: finalOtp,
        });

        if (response.status === 200) {
          const { activeUser } = response.data || {};
          Alert.alert('Success', 'Phone number verified successfully!');

          if (activeUser) {
            // Existing user → sign in
            router.replace('/(auth)/sign-in');
          } else {
            // New user → pick next step by role
            if (role === 'provider') {
              router.replace({
                pathname: '/(auth)/provider-type',
                params: { cellphoneNumber },
              });
            } else {
              router.replace({
                pathname: '/(auth)/provider-type',
                params: { cellphoneNumber },
              });
            }
          }
        } else {
          const msg = response.data?.message || 'Verification failed.';
          throw new Error(msg);
        }
      }
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'An error occurred. Please try again.';
      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (!cellphoneNumber) {
      return Alert.alert('Error', 'Could not resend code. Please go back.');
    }
    setIsResending(true);
    try {
      await apiClient.post('/auth/send-otp', { cellphoneNumber });
      Alert.alert('Code Resent', 'A new verification code has been sent to your phone.');
    } catch (error: any) {
      const errorMessage = error?.response?.data?.message || 'An error occurred.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light">
      <View className="flex-1 p-6 justify-center">
        <View className="text-center items-center mb-10">
          <Text className="text-3xl font-bold text-text-main">Enter Code</Text>
          <Text className="text-base text-text-main mt-3 text-center">
            A 6-digit code was sent to {cellphoneNumber || 'your number'}.
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
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold">Verify & Continue</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-text-main">Didn&apos;t receive code? </Text>
          <TouchableOpacity onPress={handleResendOtp} disabled={isResending}>
            {isResending ? (
              <ActivityIndicator size="small" />
            ) : (
              <Text className="text-primary font-bold">Resend</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default OTPScreen;
