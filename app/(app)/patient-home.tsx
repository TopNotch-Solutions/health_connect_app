import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, router } from "expo-router";

export default function PatientHome() {
  const { name = "Patient" } = useLocalSearchParams<{ name?: string }>();

  const onLogout = () => {
    // Minimal: navigate back to your start/selection screen
    router.replace("/selection");
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center p-6 gap-3">
        <Text className="text-3xl font-semibold">Welcome</Text>
        <Text className="text-xl text-gray-700">{String(name)}</Text>

        <TouchableOpacity
          onPress={onLogout}
          className="mt-8 px-5 py-3 rounded-2xl bg-black"
          activeOpacity={0.85}
        >
          <Text className="text-white font-medium">Log out</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
