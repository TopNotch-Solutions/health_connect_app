// app/notifications.tsx
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Notifications() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-2xl font-semibold">Notifications</Text>
        <Text className="text-gray-600 mt-2">No notifications yet.</Text>
      </View>
    </SafeAreaView>
  );
}
