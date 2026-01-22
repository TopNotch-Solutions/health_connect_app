import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image as RNImage,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const STORAGE_KEY = "hasSeenOnboarding";

const SelectionScreen = () => {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: "signup" | "onboarding" }>();
  const isSignupMode = mode === "signup";
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isSignupMode) {
      setChecking(false);
      return;
    }
    // If accessed directly (not from onboarding), redirect to sign-in
    setChecking(false);
  }, []);

  const handleSelection = async (role: "patient" | "provider") => {
    console.log("Selected Role:", role);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // Error handling
    }

    router.push({
      pathname: "/(verification)/verify-phone",
      params: { role },
    });
  };

  if (checking) {
    return (
      <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <StatusBar backgroundColor="#EFF6FF" style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <View className="flex-1 px-6 pt-8 pb-4">
        {/* Logo Section - 1/4 of screen */}
        <View className="items-center justify-center" style={{ flex: 1 }}>
          <RNImage
            source={require("../../assets/images/healthconnectlogo-cropped.png")}
            style={{ width: 120, height: 120 }}
            resizeMode="contain"
          />
          {/* <Text className="text-2xl font-bold text-gray-900 text-center mb-2">
            Join HealthConnect
          </Text> */}
          <Text className="text-sm text-gray-600 text-center px-4">
            Choose your account type to get started
          </Text>
        </View>

        {/* Selection Cards - 3/4 of screen */}
        <View style={{ gap: 12, flex: 3, justifyContent: "center" }}>
          {/* Patient Card */}
          <TouchableOpacity
            className="bg-white p-5 rounded-3xl border-2 border-gray-200 items-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            }}
            onPress={() => handleSelection("patient")}
            activeOpacity={0.7}
          >
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: "#DBEAFE" }}
            >
              <Feather name="heart" size={30} color="#3B82F6" />
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-2">
              Patient
            </Text>
            <Text className="text-sm text-gray-600 text-center mb-3 px-2">
              Access healthcare services and manage your wellness journey
            </Text>
          </TouchableOpacity>

          {/* Provider Card */}
          <TouchableOpacity
            className="bg-white p-5 rounded-3xl border-2 border-gray-200 items-center"
            style={{
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.25,
              shadowRadius: 12,
              elevation: 8,
            }}
            onPress={() => handleSelection("provider")}
            activeOpacity={0.7}
          >
            <View
              className="w-16 h-16 rounded-full items-center justify-center mb-3"
              style={{ backgroundColor: "#D1FAE5" }}
            >
              <Feather name="user-check" size={30} color="#10B981" />
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-2">
              Health Provider
            </Text>
            <Text className="text-sm text-gray-600 text-center mb-3 px-2">
              Provide care and connect with patients in your community
            </Text>
          </TouchableOpacity>
        </View>

        {/* Back to Sign In Link */}
        {isSignupMode && (
          <View className="items-center mt-6">
            <TouchableOpacity
              onPress={() => router.back()}
              className="flex-row items-center"
            >
              <Feather name="arrow-left" size={16} color="#3B82F6" />
              <Text className="text-blue-600 font-semibold text-base ml-2">
                Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <StatusBar backgroundColor="#EFF6FF" style="dark" />
    </SafeAreaView>
  );
};

export default SelectionScreen;
