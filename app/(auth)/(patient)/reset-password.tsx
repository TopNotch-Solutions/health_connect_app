// In app/(auth)/reset-password.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../../lib/api';

// Define the primary color for clarity
const PRIMARY_COLOR = '#10B981'; // Mint Green (Emerald-500)
const BORDER_COLOR = '#D1D5DB'; // Gray-300
const ACTIVE_BORDER_COLOR = '#34D399'; // Emerald-400

const ResetPasswordScreen = () => {
  const router = useRouter();
  const { userId } = useLocalSearchParams(); // Get userId from the previous screen

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // State for focusing
  const [isPasswordFocused, setIsPasswordFocused] = useState(false);
  const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);


  const handleResetPassword = async () => {
    if (!password || !confirmPassword) {
      return Alert.alert('Error', 'Please enter and confirm your new password.');
    }
    // Basic password strength check for better UX (client-side)
    if (password.length < 8) {
      return Alert.alert('Error', 'Password must be at least 8 characters long.');
    }
    if (password !== confirmPassword) {
      return Alert.alert('Error', 'Passwords do not match.');
    }
    if (!userId || typeof userId !== 'string') {
      return Alert.alert('Error', 'User ID is missing. Please restart the process.');
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post(`/app/auth/forgot-password-reset/${userId}`, {
        password,
        confirmPassword,
      });

      if (response.status === 200) {
        Alert.alert('Success', 'Your password has been reset successfully. Please log in.');
        // Assuming sign-in route is correct for replacement
        router.replace('/sign-in'); 
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to reset password. Please try again.';
      Alert.alert('Error', errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    // Use a soft, subtle background
    <SafeAreaView className="flex-1 bg-gray-50"> 
      <KeyboardAwareScrollView
        contentContainerStyle={{
          flexGrow: 1,
          paddingHorizontal: 24,
          paddingVertical: 40, // Increased top padding for better flow
          justifyContent: 'space-between',
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={150}
      >
        {/* Content Section - Card with title and fields */}
        <View>
          <View 
            className="bg-white rounded-3xl p-8 shadow-2xl" // More padding and a stronger, modern shadow
            style={{
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 12 }, // Deeper shadow effect
              shadowOpacity: 0.05,
              shadowRadius: 20,
              elevation: 10,
            }}
          >
            <View className="items-center mb-6">
              <Text className="text-4xl font-extrabold text-gray-900 text-center mb-3">
                🔐 Set New Password
              </Text>
              <Text className="text-base text-gray-600 text-center px-0">
                Choose a strong, unique password to keep your HealthConnect account secure.
              </Text>
            </View>

            {/* New Password Input */}
            <View className="mb-5">
              <Text className="text-sm text-gray-700 mb-2 font-medium">
                New Password
              </Text>
              <View
                className={`flex-row items-center bg-gray-50 rounded-xl px-4 py-4 border-2 transition-all duration-200
                  ${isPasswordFocused ? `border-[${ACTIVE_BORDER_COLOR}]` : `border-gray-200`}` // Dynamic border color
                }
              >
                <MaterialCommunityIcons name="lock-outline" size={20} color={isPasswordFocused ? PRIMARY_COLOR : '#9CA3AF'} />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Enter new password (min 8 characters)"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  onFocus={() => setIsPasswordFocused(true)}
                  onBlur={() => setIsPasswordFocused(false)}
                />
              </View>
            </View>

            {/* Confirm New Password Input */}
            <View className="mb-4">
              <Text className="text-sm text-gray-700 mb-2 font-medium">
                Confirm New Passwordsd
              </Text>
              <View
                className={`flex-row items-center bg-gray-50 rounded-xl px-4 py-4 border-2 transition-all duration-200
                  ${isConfirmPasswordFocused ? `border-[${ACTIVE_BORDER_COLOR}]` : `border-gray-200`}` // Dynamic border color
                }
              >
                <MaterialCommunityIcons name="lock-check" size={20} color={isConfirmPasswordFocused ? PRIMARY_COLOR : '#9CA3AF'} />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Re-enter new password"
                  placeholderTextColor="#9CA3AF"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  onFocus={() => setIsConfirmPasswordFocused(true)}
                  onBlur={() => setIsConfirmPasswordFocused(false)}
                />
              </View>
            </View>

            <Text className="text-xs text-gray-500 mt-2 text-center">
              A strong password uses at least 8 characters, including a number and a symbol.
            </Text>
          </View>
        </View>

        {/* Bottom Button - Kept outside the scroll view for a fixed feel (or inside for simplicity) */}
        <SafeAreaView edges={['bottom']} className="px-0 pt-8"> 
          <TouchableOpacity
            className="w-full py-4 rounded-xl items-center justify-center transition-opacity duration-200"
            style={{
              // Use a more intense shadow for the button
              backgroundColor: isLoading ? '#A7F3D0' : PRIMARY_COLOR, // Light green for loading
              shadowColor: PRIMARY_COLOR,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.35,
              shadowRadius: 10,
              elevation: 8,
            }}
            onPress={handleResetPassword}
            disabled={isLoading}
            activeOpacity={0.7} // More noticeable press effect
          >
            {isLoading ? (
              <ActivityIndicator color="#065F46" size="small" /> // Darker color for indicator contrast
            ) : (
              <Text className="text-white text-center text-lg font-bold">
                Reset Password
              </Text>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
};

export default ResetPasswordScreen;