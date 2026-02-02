import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const OnboardingSummaryScreen = () => {
  const router = useRouter();

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const completed = await AsyncStorage.getItem("onboarding-completed-v1");
        if (completed === "true") {
          router.replace("/(root)/sign-in");
        }
      } catch (e) {
        console.error("Error checking onboarding flag (summary):", e);
      }
    };

    checkOnboarding();
  }, [router]);

  const completeOnboardingAndGoToSignIn = async () => {
    try {
      await AsyncStorage.setItem("onboarding-completed-v1", "true");
    } catch (e) {
      console.error("Error saving onboarding flag (summary):", e);
    }
    router.replace("/(root)/sign-in");
  };

  const handleGetStarted = () => {
    completeOnboardingAndGoToSignIn();
  };

  const handleSkip = () => {
    completeOnboardingAndGoToSignIn();
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-indigo-50 to-white">
      <View className="flex-1">
        {/* Skip Button */}
        <View className="items-end px-6 pt-4">
          <TouchableOpacity onPress={handleSkip} className="py-2 px-4">
            <Text className="text-gray-600 font-semibold text-base">Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Content */}
        <View className="flex-1 px-6 justify-center items-center">
          {/* Illustration */}
          <View className="items-center mb-6">
            <View
              className="w-56 h-56 bg-indigo-100 rounded-full items-center justify-center mb-4"
              style={{
                shadowColor: "#4F46E5",
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Feather name="globe" size={90} color="#4F46E5" />
              <View
                className="absolute bottom-12 right-12 w-14 h-14 bg-white rounded-full items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Feather name="bell" size={20} color="#F59E0B" />
              </View>
              <View
                className="absolute top-10 left-12 w-12 h-12 bg-white rounded-full items-center justify-center"
                style={{
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Feather name="shield" size={18} color="#10B981" />
              </View>
            </View>
          </View>

          {/* Text Content */}
          <View className="items-center mb-6">
            <Text className="text-3xl font-bold text-gray-900 text-center mb-3">
              Stay Connected & In Control
            </Text>
            <Text className="text-base text-gray-600 text-center px-6 leading-6">
              Get real-time updates, reminders, and secure access to your health
              journey wherever you are.
            </Text>
          </View>

          {/* Features */}
          <View className="w-full mb-4" style={{ gap: 10 }}>
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-indigo-100 rounded-full items-center justify-center mr-3">
                <Feather name="check" size={20} color="#4F46E5" />
              </View>
              <Text className="text-base text-gray-700 flex-1">
                Real-time notifications and updates
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-indigo-100 rounded-full items-center justify-center mr-3">
                <Feather name="check" size={20} color="#4F46E5" />
              </View>
              <Text className="text-base text-gray-700 flex-1">
                Secure and encrypted data protection
              </Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-indigo-100 rounded-full items-center justify-center mr-3">
                <Feather name="check" size={20} color="#4F46E5" />
              </View>
              <Text className="text-base text-gray-700 flex-1">
                Access your health records anywhere
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom Navigation */}
        <View className="px-6 pb-6">
          {/* Get Started Button */}
          <TouchableOpacity
            className="w-full py-4 rounded-2xl items-center justify-center flex-row bg-green-600 mb-3"
            style={{
              shadowColor: "#10B981",
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text className="text-white text-center text-xl font-semibold mr-2">
              Get Started
            </Text>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Pagination Dots */}
          <View
            className="flex-row justify-center items-center"
            style={{ gap: 8 }}
          >
            <View className="w-2 h-2 bg-gray-300 rounded-full" />
            <View className="w-2 h-2 bg-gray-300 rounded-full" />
            <View className="w-8 h-2 bg-green-600 rounded-full" />
          </View>
        </View>
      </View>
      <StatusBar backgroundColor="#E0E7FF" style="dark" />
    </SafeAreaView>
  );
};

export default OnboardingSummaryScreen;
