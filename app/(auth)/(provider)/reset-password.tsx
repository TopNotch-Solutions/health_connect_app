// In app/(auth)/reset-password.tsx

import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import apiClient from '../../../lib/api';

const ResetPasswordScreen = () => {
    const router = useRouter();
    const { userId } = useLocalSearchParams(); // Get userId from the previous screen

    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleResetPassword = async () => {
        if (!password || !confirmPassword) {
            return Alert.alert('Error', 'Please enter and confirm your new password.');
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
                router.replace('/(root)/sign-in');
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'An error occurred.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView className="flex-1">
            <View className="flex-1 justify-center p-6">
                <View className="mb-10">
                    <Text className="text-4xl font-bold text-text-main">Set New Password</Text>
                    <Text className="text-lg text-text-main mt-2">Create a new, secure password for your account.</Text>
                </View>

                <View className="mb-6">
                    <Text className="text-base text-text-main mb-2 font-semibold">New Password</Text>
                    <TextInput
                        className="w-full bg-white p-4 rounded-xl text-base border border-gray-200"
                        placeholder="Enter new password"
                        value={password}
                        onChangeText={setPassword}
                        secureTextEntry
                    />
                </View>

                <View className="mb-8">
                    <Text className="text-base text-text-main mb-2 font-semibold">Confirm New Password</Text>
                    <TextInput
                        className="w-full bg-white p-4 rounded-xl text-base border border-gray-200"
                        placeholder="Confirm new password"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity
                    className={`w-full p-4 rounded-xl ${isLoading ? 'bg-gray-400' : 'bg-primary'}`}
                    onPress={handleResetPassword}
                    disabled={isLoading}
                >
                    {isLoading ? <ActivityIndicator color="#fff" /> : <Text className="text-white text-center text-lg font-semibold">Reset Password</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};

export default ResetPasswordScreen;