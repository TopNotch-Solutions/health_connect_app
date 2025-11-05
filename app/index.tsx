import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Image, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OnboardingScreen = () => {
  // useRouter is a hook from expo-router to navigate between screens
  const router = useRouter();

  return (
    // SafeAreaView ensures content is not hidden by notches or the status bar
    <SafeAreaView className="flex-1 bg-background-light">
      <View className="flex-1 justify-center items-center p-6">
        
        {/* Image/Illustration Section */}
        <View className="w-80 h-80 bg-white rounded-full justify-center items-center mb-10">
          {/* Replace this View with your <Image> component later */}
          <Image
  source={require('../assets/images/onboarding1.png')}
  className="w-80 h-80 mb-10"
  resizeMode="contain" // This is important!
/>
        </View>

        {/* Text Content Section */}
        <View className="items-center mb-10">
          <Text className="text-4xl font-bold text-text-main text-center">
            Connect with Your Health
          </Text>
          <Text className="text-lg text-text-main text-center mt-4">
            Your trusted partner in managing healthcare. Book appointments and connect with providers seamlessly.
          </Text>
        </View>

        {/* Action Button */}
        <TouchableOpacity
          className="w-full bg-primary p-4 rounded-xl"
          onPress={() => router.push('/sign-in')} // Navigates to the sign-in screen
        >
          <Text className="text-white text-center text-lg font-semibold">
            Get Started
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* This controls the style of the device's status bar (time, battery, etc.) */}
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
};

export default OnboardingScreen;