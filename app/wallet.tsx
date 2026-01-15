import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

export default function Wallet() {
  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 20 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={150}
      >
        <View className="flex-1 items-center justify-center p-6">
          <Text className="text-2xl font-semibold">Wallet</Text>
          <Text className="text-gray-600 mt-2">No transactions yet.</Text>
        </View>
      </KeyboardAwareScrollView>
    </SafeAreaView>
  );
}
