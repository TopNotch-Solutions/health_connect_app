import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY = 'hasSeenOnboarding';

const IndexScreen = () => {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(STORAGE_KEY);
        if (seen === 'true') {
          // Returning user - go directly to sign-in
          router.replace('/(root)/sign-in');
        } else {
          // First time user - show onboarding
          router.replace('/onboarding-patient');
        }
      } catch {
        router.replace('/onboarding-patient');
      }
    })();
  }, []);

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <View className="flex-1 justify-center items-center">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
      <StatusBar backgroundColor="#EFF6FF" style="dark" />
    </SafeAreaView>
  );
};

export default IndexScreen;