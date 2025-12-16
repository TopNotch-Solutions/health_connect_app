// In app/(auth)/reset-password.tsx

import { MaterialCommunityIcons } from '@expo/vector-icons'; // Added for modern inputs
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api';

// Define the primary color for the button and active states (match login/sign-in green)
const PRIMARY_COLOR = '#10B981'; // Emerald-500
const ACTIVE_BORDER_COLOR = '#34D399'; // Emerald-400

const ResetPasswordScreen = () => {
    const router = useRouter();
    // Get the userId that was passed from the OTP screen
    const { userId } = useLocalSearchParams<{ userId?: string }>();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [confirmPasswordError, setConfirmPasswordError] = useState('');
    
    // State for input focus (enhances visual feedback)
    const [isPasswordFocused, setIsPasswordFocused] = useState(false);
    const [isConfirmPasswordFocused, setIsConfirmPasswordFocused] = useState(false);

    // State for visibility toggles
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);


    const handleResetPassword = async () => {
        // Clear previous inline errors
        setPasswordError('');
        setConfirmPasswordError('');

        let hasError = false;

        if (!password) {
            setPasswordError('Password is required.');
            hasError = true;
        }
        if (!confirmPassword) {
            setConfirmPasswordError('Please confirm your password.');
            hasError = true;
        }

        // Basic length validation
        if (password && password.length < 8) {
            setPasswordError('Password must be at least 8 characters long.');
            hasError = true;
        }

        if (password && confirmPassword && password !== confirmPassword) {
            setConfirmPasswordError('The passwords do not match.');
            hasError = true;
        }

        if (hasError) {
            return;
        }

        if (!userId) {
            return Alert.alert('Error', 'User ID is missing. Please restart the password reset process.');
        }

        setIsLoading(true);
        try {
            // Call the final backend endpoint to set the new password
            const response = await apiClient.post(`/app/auth/forgot-password-reset/${userId}`, {
                password,
                confirmPassword,
            });

            if (response.status === 200) {
                Alert.alert('Success!', 'Your password has been reset successfully. Please sign in with your new password.');
                // Navigate the user back to the sign-in screen, replacing the history
                router.replace('/sign-in');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'An unexpected error occurred.';
            Alert.alert('Password Reset Failed', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <View className="flex-1 px-6 pt-10 pb-6 justify-between">
                
                {/* Header and Inputs Container */}
                <View>
                    <View className="mb-12">
                        <Text className="text-4xl font-extrabold text-gray-900 mb-3">New Password</Text>
                        <Text className="text-base text-gray-600">Create a new, secure password for your account. It must be at least 8 characters.</Text>
                    </View>

                    <View className="space-y-6">
                        {/* New Password Input */}
                        <View>
                            <Text className="text-sm font-medium text-gray-700 mb-2">New Password</Text>
                            <View
                                className="flex-row items-center bg-white rounded-xl px-4 py-3 border-2 transition-all duration-200"
                                style={{
                                    elevation: 1,
                                    borderColor: passwordError
                                        ? '#EF4444'
                                        : isPasswordFocused
                                        ? ACTIVE_BORDER_COLOR
                                        : '#E5E7EB',
                                }}
                            >
                                <MaterialCommunityIcons 
                                    name="lock-outline" 
                                    size={20} 
                                    color={isPasswordFocused ? PRIMARY_COLOR : '#9CA3AF'} 
                                />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-gray-900"
                                    placeholder="Enter new password"
                                    placeholderTextColor="#9CA3AF"
                                    value={password}
                                    onChangeText={setPassword}
                                    secureTextEntry={!showPassword}
                                    onFocus={() => setIsPasswordFocused(true)}
                                    onBlur={() => setIsPasswordFocused(false)}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowPassword(!showPassword)}
                                    className="ml-2"
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons
                                        name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="#6B7280"
                                    />
                                </TouchableOpacity>
                            </View>
                            {passwordError ? (
                                <Text className="mt-1 text-xs text-red-500">{passwordError}</Text>
                            ) : null}
                        </View>

                        {/* Confirm New Password Input */}
                        <View className="mt-2">
                            <Text className="text-sm font-medium text-gray-700 mb-2">Confirm New Password</Text>
                            <View
                                className="flex-row items-center bg-white rounded-xl px-4 py-3 border-2 transition-all duration-200"
                                style={{
                                    elevation: 1,
                                    borderColor: confirmPasswordError
                                        ? '#EF4444'
                                        : isConfirmPasswordFocused
                                        ? ACTIVE_BORDER_COLOR
                                        : '#E5E7EB',
                                }}
                            >
                                <MaterialCommunityIcons 
                                    name="lock-check-outline" 
                                    size={20} 
                                    color={isConfirmPasswordFocused ? PRIMARY_COLOR : '#9CA3AF'} 
                                />
                                <TextInput
                                    className="flex-1 ml-3 text-base text-gray-900"
                                    placeholder="Confirm new password"
                                    placeholderTextColor="#9CA3AF"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                    onFocus={() => setIsConfirmPasswordFocused(true)}
                                    onBlur={() => setIsConfirmPasswordFocused(false)}
                                    autoCapitalize="none"
                                />
                                <TouchableOpacity
                                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="ml-2"
                                    activeOpacity={0.7}
                                >
                                    <MaterialCommunityIcons
                                        name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                                        size={20}
                                        color="#6B7280"
                                    />
                                </TouchableOpacity>
                            </View>
                            {confirmPasswordError ? (
                                <Text className="mt-1 text-xs text-red-500">{confirmPasswordError}</Text>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Submit Button (Fixed at the bottom) */}
                <TouchableOpacity
                    className={`w-full py-4 rounded-xl items-center justify-center transition-opacity duration-200`}
                    style={{
                        backgroundColor: isLoading ? '#9CA3AF' : PRIMARY_COLOR,
                        shadowColor: PRIMARY_COLOR,
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.35,
                        shadowRadius: 10,
                        elevation: 8,
                    }}
                    onPress={handleResetPassword}
                    disabled={isLoading}
                    activeOpacity={0.7}
                >
                    {isLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <Text className="text-white text-center text-lg font-bold">
                            Set New Password
                        </Text>
                    )}
                </TouchableOpacity>

            </View>
            <StatusBar backgroundColor="#F9FAFB" style="dark" />
        </SafeAreaView>
    );
};

export default ResetPasswordScreen;