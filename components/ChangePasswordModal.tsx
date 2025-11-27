import { Feather } from '@expo/vector-icons';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';

interface ChangePasswordModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function ChangePasswordModal({ visible, onClose }: ChangePasswordModalProps) {
    const { user } = useAuth();
    const [isLoading, setIsLoading] = useState(false);
    const [showPasswords, setShowPasswords] = useState({
        currentPassword: false,
        newPassword: false,
        confirmPassword: false,
    });
    const [passwords, setPasswords] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });

    const handleChangePassword = async () => {
        // Validate fields
        if (!passwords.currentPassword.trim()) {
            Alert.alert('Error', 'Current password is required');
            return;
        }
        if (!passwords.newPassword.trim()) {
            Alert.alert('Error', 'New password is required');
            return;
        }
        if (!passwords.confirmPassword.trim()) {
            Alert.alert('Error', 'Please confirm your new password');
            return;
        }

        if (passwords.newPassword.length < 8) {
            Alert.alert('Error', 'Password must be at least 8 characters long');
            return;
        }

        if (passwords.newPassword !== passwords.confirmPassword) {
            Alert.alert('Error', 'New passwords do not match');
            return;
        }

        if (passwords.currentPassword === passwords.newPassword) {
            Alert.alert('Error', 'New password must be different from current password');
            return;
        }

        setIsLoading(true);
        try {
            await apiClient.patch(
                `/app/auth/change-password/${user?.userId}`,
                {
                    currentPassword: passwords.currentPassword,
                    newPassword: passwords.newPassword,
                }
            );

            Alert.alert('Success', 'Password changed successfully');
            setPasswords({ currentPassword: '', newPassword: '', confirmPassword: '' });
            onClose();
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to change password'
            );
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent={false}>
            <View className="flex-1 bg-gray-50">
                {/* Header */}
                <View className="bg-white border-b border-gray-200 pt-4 pb-4 px-4 flex-row items-center justify-between">
                    <Text className="text-xl font-bold text-gray-900">Change Password</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Feather name="x" size={24} color="#6B7280" />
                    </TouchableOpacity>
                </View>

                <View className="flex-1 px-6 pt-12">
                    {/* Current Password */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Current Password</Text>
                        <View className="flex-row items-center bg-white border border-gray-300 rounded-lg">
                            <TextInput
                                className="flex-1 px-4 py-3 text-gray-900"
                                placeholder="Enter current password"
                                secureTextEntry={!showPasswords.currentPassword}
                                value={passwords.currentPassword}
                                onChangeText={(text) => setPasswords({ ...passwords, currentPassword: text })}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPasswords({ ...showPasswords, currentPassword: !showPasswords.currentPassword })}
                                className="px-4"
                            >
                                <Feather name={showPasswords.currentPassword ? 'eye' : 'eye-off'} size={20} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* New Password */}
                    <View className="mb-6">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">New Password</Text>
                        <View className="flex-row items-center bg-white border border-gray-300 rounded-lg">
                            <TextInput
                                className="flex-1 px-4 py-3 text-gray-900"
                                placeholder="Enter new password"
                                secureTextEntry={!showPasswords.newPassword}
                                value={passwords.newPassword}
                                onChangeText={(text) => setPasswords({ ...passwords, newPassword: text })}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPasswords({ ...showPasswords, newPassword: !showPasswords.newPassword })}
                                className="px-4"
                            >
                                <Feather name={showPasswords.newPassword ? 'eye' : 'eye-off'} size={20} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Confirm Password */}
                    <View className="mb-8">
                        <Text className="text-sm font-semibold text-gray-700 mb-2">Confirm Password</Text>
                        <View className="flex-row items-center bg-white border border-gray-300 rounded-lg">
                            <TextInput
                                className="flex-1 px-4 py-3 text-gray-900"
                                placeholder="Confirm new password"
                                secureTextEntry={!showPasswords.confirmPassword}
                                value={passwords.confirmPassword}
                                onChangeText={(text) => setPasswords({ ...passwords, confirmPassword: text })}
                                editable={!isLoading}
                            />
                            <TouchableOpacity
                                onPress={() => setShowPasswords({ ...showPasswords, confirmPassword: !showPasswords.confirmPassword })}
                                className="px-4"
                            >
                                <Feather name={showPasswords.confirmPassword ? 'eye' : 'eye-off'} size={20} color="#6B7280" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Password Requirements */}
                    <View className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-8">
                        <Text className="text-sm font-semibold text-blue-900 mb-2">Password Requirements:</Text>
                        <Text className="text-xs text-blue-800">• At least 8 characters long</Text>
                        <Text className="text-xs text-blue-800">• Must be different from current password</Text>
                    </View>

                    {/* Change Password Button */}
                    <TouchableOpacity
                        onPress={handleChangePassword}
                        disabled={isLoading}
                        className="bg-blue-600 py-3 rounded-lg flex-row items-center justify-center mb-4"
                    >
                        {isLoading ? (
                            <ActivityIndicator color="white" />
                        ) : (
                            <>
                                <Feather name="lock" size={20} color="white" />
                                <Text className="text-white font-semibold ml-2">Change Password</Text>
                            </>
                        )}
                    </TouchableOpacity>

                    {/* Cancel Button */}
                    <TouchableOpacity
                        onPress={onClose}
                        disabled={isLoading}
                        className="bg-gray-200 py-3 rounded-lg flex-row items-center justify-center"
                    >
                        <Text className="text-gray-700 font-semibold">Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
}
