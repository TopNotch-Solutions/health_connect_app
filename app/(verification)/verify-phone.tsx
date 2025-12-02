import { Feather } from '@expo/vector-icons';
import axios from 'axios';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
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
        router.push({ 
          pathname: '/verify-otp', 
          params: { 
            phoneNumber: fullPhoneNumber, 
             flow: params.flow ,
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
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <View className="flex-1">
        {/* Top Content Container */}
        <KeyboardAwareScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 40 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          enableOnAndroid={true}
          enableAutomaticScroll={true}
          extraScrollHeight={150}
        >
          <View>
            <Text className="text-3xl font-bold text-gray-900 text-center mb-3">
              Verify Your Phone
            </Text>
            <Text className="text-base text-gray-600 text-center px-4 mb-8">
              We&apos;ll send you a verification code to confirm your number
            </Text>

            {/* Phone Input Section */}
            <View>
              <Text className="text-base font-medium text-gray-700 mb-2">
                Phone Number
              </Text>
              <View className="w-full bg-white rounded-2xl border-2 border-gray-300 flex-row items-center px-5 py-4"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <View className="mr-3">
                  <Text className="text-2xl">🇳🇦</Text>
                </View>
                <View className="w-16 mr-3">
                  <Text className="text-base font-semibold text-gray-700">
                    +264
                  </Text>
                </View>
                <View className="w-px h-8 bg-gray-300 mr-3" />
                <Feather name="phone" size={20} color="#3B82F6" />
                <TextInput
                  className="flex-1 text-base text-gray-900 ml-3"
                  placeholder="81 234 5678"
                  placeholderTextColor="#9CA3AF"
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  maxLength={12}
                />
              </View>
              <Text className="text-sm text-gray-500 mt-2 ml-1">
                Enter your 9-digit Namibian phone number
              </Text>
            </View>
          </View>
        </KeyboardAwareScrollView>

        {/* Bottom Button - Fixed at bottom with safe area */}
        <SafeAreaView edges={['bottom']} className="px-6 pb-4">
          <TouchableOpacity
            className="w-full py-5 rounded-2xl items-center justify-center"
            style={{
              backgroundColor: isLoading ? '#9CA3AF' : '#10B981',
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={handleSendCode}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View className="flex-row items-center">
                <Text className="text-white text-xl font-semibold mr-2">
                  Send Verification Code
                </Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </SafeAreaView>
  );
};

export default VerifyPhoneScreen;