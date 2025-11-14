import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ActivityIndicator, Alert, Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext';

// --- A Reusable Component for the Menu Items ---
const ProfileMenuItem = ({ icon, label, onPress, isDestructive = false }: { icon: any; label: string; onPress: () => void; isDestructive?: boolean; }) => (
    <TouchableOpacity onPress={onPress} className="bg-white p-4 flex-row items-center justify-between">
        <View className="flex-row items-center" style={{ gap: 16 }}>
            <Feather name={icon} size={22} color={isDestructive ? "#EF4444" : "#6C757D"} />
            <Text className={`text-base ${isDestructive ? 'text-red-500' : 'text-text-main'}`}>{label}</Text>
        </View>
        {!isDestructive && <Feather name="chevron-right" size={22} color="#CBD5E1" />}
    </TouchableOpacity>
);

export default function ProfileScreen() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);

    // This is the base URL where your backend serves images.
    // YOU MUST CONFIRM THIS from your backend's `server.js` or `app.js` file.
    // It's often where you see a line like `app.use(express.static('public'))`.
    const IMAGE_BASE_URL = 'http://YOUR_COMPUTER_IP:4000/images/';

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
                    } catch (error) {
                        Alert.alert("Error", "Could not log out. Please try again.");
                    } finally {
                        setIsLoading(false);
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView className="flex-1">
            <ScrollView contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Profile Header */}
                <View className="items-center p-6 border-b border-b-gray-200 bg-white">
                    {user?.profileImage ? (
                        <Image
                            source={{ uri: `${IMAGE_BASE_URL}${user.profileImage}` }}
                            className="w-24 h-24 rounded-full mb-4"
                        />
                    ) : (
                        <View className="w-24 h-24 rounded-full bg-primary/10 justify-center items-center mb-4">
                            <Feather name="user" size={48} color="#007BFF" />
                        </View>
                    )}
                    <Text className="text-2xl font-bold text-text-main">{user?.fullname || 'User Name'}</Text>
                    <Text className="text-base text-gray-500 mt-1">{user?.email || 'user@email.com'}</Text>
                </View>

                {/* Menu Groups */}
                <View className="mt-6 px-4">
                    {/* Account Section */}
                    <View className="mb-6">
                        <Text className="font-bold text-gray-500 text-sm uppercase px-4 mb-2">Account</Text>
                        <View className="bg-white rounded-xl overflow-hidden border border-gray-200">
                            <ProfileMenuItem icon="edit-3" label="Edit Profile" onPress={() => { /* TODO: Navigate to Edit Profile Screen */ }} />
                            <View className="h-px bg-gray-200" />
                            <ProfileMenuItem icon="shield" label="Security" onPress={() => { /* TODO: Navigate to Security Screen */ }} />
                        </View>
                    </View>

                    {/* Support Section */}
                    <View>
                        <Text className="font-bold text-gray-500 text-sm uppercase px-4 mb-2">Support</Text>
                        <View className="bg-white rounded-xl overflow-hidden border border-gray-200">
                            <ProfileMenuItem icon="help-circle" label="Help & Support" onPress={() => router.push('/(app)/(patient)/issues')} />
                            <View className="h-px bg-gray-200" />
                            <ProfileMenuItem icon="info" label="About" onPress={() => { /* TODO: Navigate to About Screen */ }} />
                        </View>
                    </View>
                </View>

                {/* Spacer */}
                <View className="h-10" />

                {/* Logout Button */}
                <View className="px-4">
                    <View className="bg-white rounded-xl overflow-hidden border border-gray-200">
                        <ProfileMenuItem icon="log-out" label="Log Out" onPress={handleLogout} isDestructive />
                    </View>
                </View>

                {/* Show a spinner overlay while logging out */}
                {isLoading && (
                    <View className="absolute top-0 bottom-0 left-0 right-0 bg-black/20 justify-center items-center">
                        <ActivityIndicator size="large" color="#FFFFFF" />
                    </View>
                )}
            </ScrollView>
        </SafeAreaView>
    );
}