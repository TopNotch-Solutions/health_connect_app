import React from "react";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ProviderSettings() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 p-6">
        <Text className="text-2xl font-semibold">Your Settings</Text>
        <Text className="text-gray-600 mt-2">
          Settings to tailor to your needs
        </Text>
      </View>
    </SafeAreaView>
  );
}
