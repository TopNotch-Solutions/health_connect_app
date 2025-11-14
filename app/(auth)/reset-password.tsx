// In app/(auth)/reset-password.tsx

import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../lib/api';

const ResetPasswordScreen = () => {
    const router = useRouter();
    // Get the userId that was passed from the OTP screen
    const { userId } = useLocalSearchParams<{ userId?: string }>();

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async () => {
        if (!password || !confirmPassword) {
            return Alert.alert('Error', 'Please enter and confirm your new password.');
        }
        if (password !== confirmPassword) {
            return Alert.alert('Error', 'The new passwords do not match.');
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
                router.replace('/(root)/sign-in');
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
            <View className="flex-1 px-6 justify-center">
                <View className="mb-10">
                    <Text className="text-3xl font-bold text-gray-900 mb-2">Set New Password</Text>
                    <Text className="text-base text-gray-600">Create a new, secure password for your account.</Text>
                </View>

                <View className="space-y-5">
                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">New Password</Text>
                        <TextInput
                            className="w-full bg-white px-4 py-3.5 rounded-lg text-base border border-gray-300 text-gray-900"
                            placeholder="Enter new password"
                            placeholderTextColor="#9CA3AF"
                            value={password}
                            onChangeText={setPassword}
                            secureTextEntry
                        />
                    </View>

                    <View>
                        <Text className="text-sm font-medium text-gray-700 mb-2">Confirm New Password</Text>
                        <TextInput
                            className="w-full bg-white px-4 py-3.5 rounded-lg text-base border border-gray-300 text-gray-900"
                            placeholder="Confirm new password"
                            placeholderTextColor="#9CA3AF"
                            value={confirmPassword}
                            onChangeText={setConfirmPassword}
                            secureTextEntry
                        />
                    </View>

                    <TouchableOpacity
                        className={`w-full py-4 rounded-lg mt-4 ${isLoading ? 'bg-gray-400' : 'bg-blue-600'}`}
                        onPress={handleResetPassword}
                        disabled={isLoading}
                        activeOpacity={0.8}
                    >
                        {isLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text className="text-white text-center text-base font-semibold">Reset Password</Text>}
                    </TouchableOpacity>
                </View>
            </View>
            <StatusBar backgroundColor="#F9FAFB" style="dark" />
        </SafeAreaView>
    );
};

export default ResetPasswordScreen;