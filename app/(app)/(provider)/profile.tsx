import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChangePasswordModal from '../../../components/ChangePasswordModal';
import EditProviderProfileModal from '../../../components/EditProviderProfileModal';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';

const ProfileMenuItem = ({ icon, label, onPress, isDestructive = false }: { icon: any; label: string; onPress: () => void; isDestructive?: boolean; }) => (
    <TouchableOpacity onPress={onPress} className="flex-row items-center justify-between p-4">
        <View className="flex-row items-center">
            <View className={`w-10 h-10 rounded-full items-center justify-center mr-3 ${
                isDestructive ? 'bg-red-50' : 'bg-gray-50'
            }`}>
                <Feather name={icon} size={18} color={isDestructive ? "#EF4444" : "#6B7280"} />
            </View>
            <Text className={`text-base font-semibold ${
                isDestructive ? 'text-red-500' : 'text-gray-900'
            }`}>{label}</Text>
        </View>
        {!isDestructive && <Feather name="chevron-right" size={20} color="#D1D5DB" />}
    </TouchableOpacity>
);

export default function ProfileScreen() {
    const { user, logout } = useAuth();
    const [isLoading, setIsLoading] = React.useState(false);
    const [editProfileVisible, setEditProfileVisible] = React.useState(false);
    const [changePasswordVisible, setChangePasswordVisible] = React.useState(false);

    const IMAGE_BASE_URL = 'http://192.168.11.138:4000/images/';

    const handleDeactivateAccount = () => {
        Alert.alert(
            'Deactivate Account',
            'Are you sure you want to deactivate your account? This action cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Deactivate',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setIsLoading(true);
                            await apiClient.patch(`/app/auth/deactivate-account/${user?.userId}`);
                            Alert.alert('Account Deactivated', 'Your account has been deactivated', [
                                {
                                    text: 'OK',
                                    onPress: async () => {
                                        await logout();
                                    },
                                },
                            ]);
                        } catch (error: any) {
                            Alert.alert('Error', error.response?.data?.message || 'Failed to deactivate account');
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    };

    const handleLogout = () => {
        Alert.alert("Log Out", "Are you sure you want to log out?", [
            { text: "Cancel", style: "cancel" },
            {
                text: "Log Out", style: "destructive",
                onPress: async () => {
                    setIsLoading(true);
                    try {
                        await logout();
                    } catch {
                        Alert.alert("Error", "Could not log out. Please try again.");
                    } finally {
                        setIsLoading(false);
                    }
                },
            },
        ]);
    };

    const handleRemoveProfileImage = () => {
        Alert.alert(
            "Remove Profile Image",
            "Are you sure you want to remove your profile image?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Remove",
                    style: "destructive",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            await apiClient.delete(`/app/auth/remove-profile-image/${user?.userId}`);
                            Alert.alert("Success", "Profile image removed successfully");
                        } catch (error: any) {
                            Alert.alert(
                                "Error",
                                error.response?.data?.message || "Failed to remove profile image"
                            );
                        } finally {
                            setIsLoading(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView className="flex-1 bg-gray-50">
            <ScrollView className="flex-1">
                {/* Profile Header */}
                <View className="bg-white items-center pt-8 pb-6 px-6 border-b border-gray-200">
                    {user?.profileImage ? (
                        <Image
                            source={{ uri: `${IMAGE_BASE_URL}${user.profileImage}` }}
                            className="w-24 h-24 rounded-full mb-4 border-4 border-blue-100"
                        />
                    ) : (
                        <View className="w-24 h-24 rounded-full bg-blue-50 justify-center items-center mb-4 border-4 border-blue-100">
                            <Feather name="user" size={40} color="#3B82F6" />
                        </View>
                    )}
                    <Text className="text-2xl font-bold text-gray-900">{user?.fullname || 'Provider Name'}</Text>
                    <Text className="text-base text-gray-500 mt-1">{user?.email || 'provider@email.com'}</Text>
                    {user?.role && (
                        <View className="bg-blue-50 px-4 py-1.5 rounded-full mt-3">
                            <Text className="text-blue-600 font-bold text-sm capitalize">{user.role}</Text>
                        </View>
                    )}
                    {user?.profileImage && (
                        <TouchableOpacity 
                            onPress={handleRemoveProfileImage} 
                            disabled={isLoading}
                            className="mt-4 bg-red-100 px-4 py-2 rounded-lg"
                        >
                            <Text className="text-red-600 font-semibold text-sm">Remove Photo</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Menu Sections */}
                <View className="px-6 pt-6">
                    {/* Account Section */}
                    <View className="mb-4">
                        <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-2">
                            Account
                        </Text>
                        <View className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <ProfileMenuItem icon="edit-3" label="Edit Profile" onPress={() => setEditProfileVisible(true)} />
                            <View className="h-px bg-gray-100 mx-4" />
                            <ProfileMenuItem icon="lock" label="Change Password" onPress={() => setChangePasswordVisible(true)} />
                        </View>
                    </View>

                    {/* Support Section */}
                    <View className="mb-4">
                        <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-2">
                            Support
                        </Text>
                        <View className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                            <ProfileMenuItem icon="help-circle" label="Help & Support" onPress={() => {}} />
                            <View className="h-px bg-gray-100 mx-4" />
                            <ProfileMenuItem icon="info" label="About HealthConnect" onPress={() => {}} />
                        </View>
                    </View>

                    {/* Danger Zone */}
                    <View className="mb-6">
                        <Text className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-3 px-2">
                            Danger Zone
                        </Text>
                        <View className="bg-white rounded-xl border border-red-200 overflow-hidden">
                            <ProfileMenuItem icon="alert-circle" label="Deactivate Account" onPress={handleDeactivateAccount} isDestructive />
                        </View>
                    </View>

                    {/* Logout */}
                    <View className="mb-6">
                        <View className="bg-white rounded-xl border border-red-200 overflow-hidden">
                            <ProfileMenuItem icon="log-out" label="Log Out" onPress={handleLogout} isDestructive />
                        </View>
                    </View>
                </View>

                {isLoading && (
                    <View className="absolute inset-0 bg-black/20 justify-center items-center">
                        <View className="bg-white rounded-2xl p-6">
                            <ActivityIndicator size="large" color="#3B82F6" />
                            <Text className="text-gray-900 mt-3 font-semibold">Logging out...</Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* Edit Profile Modal */}
            <EditProviderProfileModal 
                visible={editProfileVisible} 
                onClose={() => setEditProfileVisible(false)} 
            />

            {/* Change Password Modal */}
            <ChangePasswordModal 
                visible={changePasswordVisible} 
                onClose={() => setChangePasswordVisible(false)} 
            />
        </SafeAreaView>
    );
}