import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const OnboardingProviderScreen = () => {
  const router = useRouter();

  const handleNext = () => {
    router.push('/onboarding-summary');
  };

  const handleSkip = () => {
    router.push('/(root)/sign-in');
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-green-50 to-white">
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
              className="w-56 h-56 bg-green-100 rounded-full items-center justify-center mb-4"
              style={{
                shadowColor: '#10B981',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.2,
                shadowRadius: 16,
                elevation: 8,
              }}
            >
              <Feather name="user-check" size={90} color="#10B981" />
              <View className="absolute bottom-12 right-12 w-14 h-14 bg-white rounded-full items-center justify-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Feather name="calendar" size={20} color="#3B82F6" />
              </View>
              <View className="absolute top-10 left-12 w-12 h-12 bg-white rounded-full items-center justify-center"
                style={{
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.15,
                  shadowRadius: 8,
                  elevation: 4,
                }}
              >
                <Feather name="clipboard" size={18} color="#8B5CF6" />
              </View>
            </View>
          </View>

          {/* Text Content */}
          <View className="items-center mb-6">
            <Text className="text-3xl font-bold text-gray-900 text-center mb-3">
              Empower Your Practice
            </Text>
            <Text className="text-base text-gray-600 text-center px-6 leading-6">
              Streamline patient care with digital tools. Manage appointments, patient records, and consultations all from one platform.
            </Text>
          </View>

          {/* Features */}
          <View className="w-full mb-4" style={{ gap: 10 }}>
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Feather name="check" size={20} color="#3B82F6" />
              </View>
              <Text className="text-base text-gray-700 flex-1">Flexible scheduling and availability</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Feather name="check" size={20} color="#3B82F6" />
              </View>
              <Text className="text-base text-gray-700 flex-1">Digital patient management system</Text>
            </View>
            <View className="flex-row items-center">
              <View className="w-10 h-10 bg-blue-100 rounded-full items-center justify-center mr-3">
                <Feather name="check" size={20} color="#3B82F6" />
              </View>
              <Text className="text-base text-gray-700 flex-1">Secure payment processing</Text>
            </View>
          </View>

        </View>

        {/* Bottom Navigation */}
        <View className="px-6 pb-6">
          {/* Next Button */}
          <TouchableOpacity
            className="w-full py-4 rounded-2xl items-center justify-center flex-row bg-green-600 mb-3"
            style={{
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={handleNext}
            activeOpacity={0.8}
          >
            <Text className="text-white text-center text-xl font-semibold mr-2">Next</Text>
            <Feather name="arrow-right" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Pagination Dots */}
          <View className="flex-row justify-center items-center" style={{ gap: 8 }}>
            <View className="w-2 h-2 bg-gray-300 rounded-full" />
            <View className="w-8 h-2 bg-green-600 rounded-full" />
            <View className="w-2 h-2 bg-gray-300 rounded-full" />
          </View>
        </View>

      </View>
      <StatusBar backgroundColor="#D1FAE5" style="dark" />
    </SafeAreaView>
  );
};

export default OnboardingProviderScreen;
