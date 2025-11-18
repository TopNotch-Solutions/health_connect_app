import { Feather } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api';

const OTPScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [otp, setOtp] = useState<string[]>(new Array(6).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);

  // Normalize params to ensure they are always strings
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

  const handleVerifyOtp = () => { 
    console.log("Current flow parameter:", params.flow);// Removed 'async' to use .then/.catch for better debugging
    const finalOtp = otp.join('');
    if (finalOtp.length < 6) {
      return Alert.alert('Invalid Code', 'Please enter the complete 6-digit code.');
    }
    if (!cellphoneNumber) {
      return Alert.alert('Error', 'Missing phone number. Please go back and try again.');
    }

    setIsLoading(true);

    let promise;
    let isResetFlow = typeof params.flow === 'string' && params.flow === 'resetPassword';

    if (isResetFlow) {
        promise = apiClient.post('/app/auth/forgot-password-verify-otp', {
            cellphoneNumber,
            otp: finalOtp,
        });
    } else {
        promise = apiClient.post('/auth/verify-otp', {
            cellphoneNumber,
            otp: finalOtp,
        });
    }

    promise.then(response => {
        setIsLoading(false);
        console.log("Backend Response:", JSON.stringify(response.data, null, 2));

        if (isResetFlow) {
            if (response.status === 200 && response.data?.userId) {
                // Navigate directly without success message
                router.replace({
                    pathname: '/(auth)/reset-password',
                    params: { userId: String(response.data.userId) },
                });
            } else {
                Alert.alert('Verification Failed', response.data?.message || 'User ID not found in response.');
            }
        } else {
            const { activeUser } = response.data || {};
            // Navigate directly without success message
            if (activeUser) {
                router.replace('/(root)/sign-in');
            } else {
                if (role === 'provider') {
                    router.replace({ pathname: '/(auth)/(provider)/provider-type', params: { cellphoneNumber } });
                } else {
                    router.replace({ pathname: '/(auth)/(patient)/registration', params: { cellphoneNumber } });
                }
            }
        }
    }).catch(error => {
        setIsLoading(false);
        console.error("--- DETAILED API ERROR ---");
        if (error.response) {
            console.error("Response Data:", error.response.data);
            console.error("Response Status:", error.response.status);
        } else if (error.request) {
            console.error("No response received:", error.request);
        } else {
            console.error('Error Message:', error.message);
        }
        const errorMessage = error.response?.data?.message || 'A network error occurred. Please check your connection and the API endpoint.';
        Alert.alert('Verification Failed', errorMessage);
    });
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
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={150}
      >
        
        {/* Logo Section */}
        <View className="items-center mb-12">
          <Image 
            source={require('../../assets/images/healthconnectlogo.png')}
            style={{ width: 180, height: 180, marginBottom: 24 }}
            resizeMode="contain"
          />
          <View className="bg-green-100 w-20 h-20 rounded-full items-center justify-center mb-6"
            style={{
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 4,
            }}
          >
            <Feather name="shield" size={40} color="#10B981" />
          </View>
          <Text className="text-3xl font-bold text-gray-900 text-center mb-3">Verify Your Code</Text>
          <Text className="text-base text-gray-600 text-center px-4">
            Enter the 6-digit code sent to {'\n'}
            <Text className="font-semibold text-gray-900">{cellphoneNumber || 'your number'}</Text>
          </Text>
        </View>

        {/* OTP Input Section */}
        <View className="mb-8">
          <View className="flex-row justify-between w-full mb-8">
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputs.current[index] = ref; }}
                className="w-14 h-16 bg-white rounded-2xl border-2 border-green-300 text-center text-2xl font-bold text-gray-900"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
              />
            ))}
          </View>

          {/* Verify Button */}
          <TouchableOpacity
            className={`w-full py-5 rounded-2xl items-center justify-center flex-row ${isLoading ? 'bg-gray-400' : 'bg-green-600'}`}
            style={{
              backgroundColor: isLoading ? '#9CA3AF' : '#10B981',
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={handleVerifyOtp}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text className="text-white text-center text-xl font-semibold mr-2">Verify & Continue</Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* Resend Section */}
        <View className="flex-row justify-center items-center mt-4">
          <Text className="text-gray-600 text-base">Didn&apos;t receive code? </Text>
          <TouchableOpacity onPress={handleResendOtp} disabled={isResending}>
            {isResending ? (
              <ActivityIndicator size="small" color="#10B981"/>
            ) : (
              <Text className="text-green-600 font-semibold text-base">Resend</Text>
            )}
          </TouchableOpacity>
        </View>
        
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default OTPScreen;