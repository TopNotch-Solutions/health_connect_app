import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const STORAGE_KEY = 'hasSeenOnboarding';

const SelectionScreen = () => {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: 'signup' | 'onboarding' }>();
  const isSignupMode = mode === 'signup';
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isSignupMode) {
      setChecking(false);
      return;
    }
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(STORAGE_KEY);
        if (seen === 'true') {
          router.replace('/(root)/sign-in');
          return;
        }
      } catch {
        // Error handling
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const handleSelection = async (role: 'patient' | 'provider') => {
    console.log('Selected Role:', role);

    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Error handling
    }

    router.push({
      pathname: '/(verification)/verify-phone',
      params: { role },
    });
  };

  if (checking) {
    return (
      <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
        <ActivityIndicator size="large" color="#3B82F6" />
        <StatusBar backgroundColor="#F9FAFB" style="dark" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 px-6 pt-12">
        
        {/* Header Section */}
        <View className="items-center mb-16">
          <Text className="text-3xl font-bold text-gray-900 text-center mb-3">
            Registration Type
          </Text>
          <Text className="text-base text-gray-600 text-center">
            Choose how you'll be using the platform
          </Text>
        </View>

        {/* Selection Cards */}
        <View>
          {/* Patient Card */}
          <TouchableOpacity
            className="w-full bg-white p-5 rounded-xl border border-gray-200 flex-row items-center mb-4 shadow-sm"
            onPress={() => handleSelection('patient')}
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 bg-blue-50 rounded-full items-center justify-center">
              <Feather name="user" size={24} color="#3B82F6" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-lg font-semibold text-gray-900 mb-1">Patient</Text>
              <Text className="text-sm text-gray-600">
                Book appointments and manage your health
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>

          {/* Provider Card */}
          <TouchableOpacity
            className="w-full bg-white p-5 rounded-xl border border-gray-200 flex-row items-center shadow-sm"
            onPress={() => handleSelection('provider')}
            activeOpacity={0.7}
          >
            <View className="w-12 h-12 bg-green-50 rounded-full items-center justify-center">
              <Feather name="briefcase" size={24} color="#10B981" />
            </View>
            <View className="flex-1 ml-4">
              <Text className="text-lg font-semibold text-gray-900 mb-1">Health Provider</Text>
              <Text className="text-sm text-gray-600">
                Manage patients and appointments
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>

        {/* Back to Sign In Link */}
        {isSignupMode && (
          <View className="items-center mt-12">
            <TouchableOpacity onPress={() => router.back()}>
              <Text className="text-blue-600 font-semibold text-sm">
                Back to Sign In
              </Text>
            </TouchableOpacity>
          </View>
        )}

      </View>
      <StatusBar backgroundColor="#F9FAFB" style="dark" />
    </SafeAreaView>
  );
};

export default SelectionScreen;