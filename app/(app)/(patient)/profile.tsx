import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import ChangePasswordModal from '../../../components/ChangePasswordModal';
import EditPatientProfileModal from '../../../components/EditPatientProfileModal';
import { useAuth } from '../../../context/AuthContext';
import apiClient from '../../../lib/api';

// --- A Reusable Component for the Menu Items ---
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
    const { user, logout, updateUser } = useAuth();
    const [isLoading, setIsLoading] = React.useState(false);
    const [isUploading, setIsUploading] = React.useState(false);
    const [editProfileVisible, setEditProfileVisible] = React.useState(false);
    const [changePasswordVisible, setChangePasswordVisible] = React.useState(false);
    const [selectedImage, setSelectedImage] = React.useState<ImagePicker.ImagePickerAsset | null>(null);

    // This is the base URL where your backend serves images.
    // YOU MUST CONFIRM THIS from your backend's `server.js` or `app.js` file.
    // It's often where you see a line like `app.use(express.static('public'))`.
    const IMAGE_BASE_URL = 'http://13.61.152.64:4000/images/';

    const handlePickImage = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'We need gallery permissions to select an image.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setSelectedImage(result.assets[0]);
                await handleUploadImage(result.assets[0]);
            }
        } catch (error: any) {
            Alert.alert('Error', 'Failed to pick image. Please try again.');
            console.error('Image picker error:', error);
        }
    };

    const handleUploadImage = async (image: ImagePicker.ImagePickerAsset) => {
        if (!user?.userId) {
            Alert.alert('Error', 'User not found. Please try again.');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('profileImage', {
                uri: image.uri,
                name: image.fileName || `profile-${Date.now()}.jpg`,
                type: image.mimeType || 'image/jpeg',
            } as any);

            const response = await apiClient.patch(
                `/app/auth/upload-profile-image/${user.userId}`,
                formData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            if (response.data?.profileImage) {
                await updateUser({ profileImage: response.data.profileImage });
                console.log(response.data);
                Alert.alert('Success', 'Profile photo updated successfully!');
            } else {
                Alert.alert('Success', 'Profile photo updated successfully!');
            }
        } catch (error: any) {
            Alert.alert(
                'Error',
                error.response?.data?.message || 'Failed to upload profile photo. Please try again.'
            );
            console.error('Upload error:', error);
        } finally {
            setIsUploading(false);
            setSelectedImage(null);
        }
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
                        // The root layout will handle the redirection automatically.
                    } catch {
                        Alert.alert("Error", "Could not log out. Please try again");
                    } finally {
                        setIsLoading(false);
                    }
                },
            },
        ]);
    };

    const handleDeactivateAccount = () => {
        Alert.alert(
            "Deactivate Account",
            "Are you sure you want to deactivate your account? This action cannot be undone.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Deactivate",
                    style: "destructive",
                    onPress: async () => {
                        setIsLoading(true);
                        try {
                            const response = await apiClient.patch(
                                `/app/auth/deactivate-account/${user?.userId}`
                            );

                            if (response.data.status) {
                                Alert.alert(
                                    "Account Deactivated",
                                    "Your account has been deactivated successfully.",
                                    [
                                        {
                                            text: "OK",
                                            onPress: async () => {
                                                await logout();
                                            },
                                        },
                                    ]
                                );
                            }
                        } catch (error: any) {
                            Alert.alert(
                                "Error",
                                error.response?.data?.message || "Failed to deactivate account"
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
        <SafeAreaView className="flex-1 bg-gray-50" edges={['bottom', 'left', 'right']}>
            <ScrollView className="flex-1">
                {/* Profile Header */}
                <View className="bg-white items-center pt-8 pb-6 px-6 border-b border-gray-200">
                    {selectedImage ? (
                        <Image
                            source={{ uri: selectedImage.uri }}
                            className="w-32 h-32 rounded-full mb-4 border-4 border-blue-100"
                            style={{ width: 128, height: 128, borderRadius: 64 }}
                        />
                    ) : user?.profileImage ? (
                        <Image
                            source={{ uri: `${IMAGE_BASE_URL}${user.profileImage}` }}
                            className="w-32 h-32 rounded-full mb-4 border-4 border-blue-100"
                            style={{ width: 128, height: 128, borderRadius: 64 }}
                        />
                    ) : (
                        <View className="w-32 h-32 rounded-full bg-blue-50 justify-center items-center mb-4 border-4 border-blue-100">
                            <Feather name="user" size={50} color="#3B82F6" />
                        </View>
                    )}
                    <Text className="text-2xl font-bold text-gray-900">{user?.fullname || 'Patient Name'}</Text>
                    <Text className="text-base text-gray-500 mt-1">{user?.email || 'patient@email.com'}</Text>
                    <TouchableOpacity 
                        onPress={handlePickImage} 
                        disabled={isLoading || isUploading}
                        className="mt-4 bg-blue-100 px-4 py-2 rounded-lg"
                        style={{ opacity: (isLoading || isUploading) ? 0.6 : 1 }}
                    >
                        {isUploading ? (
                            <View className="flex-row items-center">
                                <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 8 }} />
                                <Text className="text-blue-600 font-semibold text-sm">Uploading...</Text>
                            </View>
                        ) : (
                            <Text className="text-blue-600 font-semibold text-sm">Upload Photo</Text>
                        )}
                    </TouchableOpacity>
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
            <EditPatientProfileModal 
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