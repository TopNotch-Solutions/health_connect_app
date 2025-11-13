import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProviderProfile() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-6">
        <Text className="text-2xl font-semibold">Your Profile</Text>
        <Text className="text-gray-600 mt-2">
          Manage your details, documents, and availability.
        </Text>
      </View>
    </SafeAreaView>
  );
}
