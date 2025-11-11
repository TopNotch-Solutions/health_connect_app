// app/(tabs)/transactions.tsx
import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Transactions() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center p-6">
        <Text className="text-2xl font-semibold">Transactions</Text>
        <Text className="text-gray-600 mt-2">Wallet history & payments.</Text>
      </View>
    </SafeAreaView>
  );
}
