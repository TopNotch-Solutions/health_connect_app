import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import ScreenLayout, { SCREEN_EDGES_FULL } from "../components/ScreenLayout";

const STORAGE_KEY = "hasSeenOnboarding";

const IndexScreen = () => {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(STORAGE_KEY);
        if (seen === "true") {
          // Returning user - go directly to sign-in
          router.replace("/(root)/sign-in");
        } else {
          // First time user - show onboarding
          router.replace("/onboarding-patient");
        }
      } catch {
        router.replace("/onboarding-patient");
      }
    })();
  }, []);

  return (
    <ScreenLayout edges={SCREEN_EDGES_FULL}>
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
      <StatusBar backgroundColor="#EFF6FF" style="dark" />
    </ScreenLayout>
  );
};

export default IndexScreen;
