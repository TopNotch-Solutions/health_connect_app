// In app/(patient)/profile.tsx

import { Feather } from '@expo/vector-icons';
import React from 'react';
import { ActivityIndicator, Alert, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../../context/AuthContext'; // 1. Import our useAuth hook

export default function ProfileScreen() {
  // 2. Get the user object and the logout function from our context
  const { user, logout } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleLogout = () => {
    // We add a confirmation alert for better UX
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        // The "No" button
        {
          text: "Cancel",
          style: "cancel",
        },
        // The "Yes" button
        {
          text: "Yes, Log Out",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            try {
              // 3. Call the logout function from the context
              await logout();
              // On success, the ProtectedLayout in `app/_layout.tsx` will automatically
              // detect that the user is no longer authenticated and redirect to the sign-in screen.
            } catch (error) {
              console.error("Logout failed:", error);
              Alert.alert("Error", "Could not log out. Please try again.");
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 p-6">
        {/* Profile Header */}
        <View className="items-center mb-10">
          <View className="w-24 h-24 rounded-full bg-primary/20 justify-center items-center mb-4">
            <Feather name="user" size={48} color="#007BFF" />
          </View>
          <Text className="text-2xl font-bold text-text-main">{user?.fullname || 'User Name'}</Text>
          <Text className="text-base text-gray-500 mt-1">{user?.email || 'user@email.com'}</Text>
        </View>

        {/* Menu Options (can be expanded later) */}
        <View className="space-y-2">
            <TouchableOpacity className="bg-white p-4 rounded-xl flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Feather name="edit-3" size={20} color="#6C757D" />
                    <Text className="text-base text-text-main">Edit Profile</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#6C757D" />
            </TouchableOpacity>
             <TouchableOpacity className="bg-white p-4 rounded-xl flex-row items-center justify-between">
                <View className="flex-row items-center" style={{ gap: 12 }}>
                    <Feather name="settings" size={20} color="#6C757D" />
                    <Text className="text-base text-text-main">Settings</Text>
                </View>
                <Feather name="chevron-right" size={20} color="#6C757D" />
            </TouchableOpacity>
        </View>

        {/* Spacer to push logout button to the bottom */}
        <View className="flex-1" />

        {/* Logout Button */}
        <TouchableOpacity
          className="bg-red-500 p-4 rounded-xl flex-row justify-center items-center"
          onPress={handleLogout}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#EF4444" />
          ) : (
            <>
              <Feather name="log-out" size={20} color="white" />
              <Text className="text-white text-center text-lg font-semibold ml-2">Log Out</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}