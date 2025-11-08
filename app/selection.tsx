import { Feather } from '@expo/vector-icons'; // A great library for icons
import { useRouter, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SelectionScreen = () => {
  const router = useRouter();

  const handleSelection = (role: 'patient' | 'provider') => {
    console.log('Selected Role:', role);
    
    router.push({
      pathname: '/(verification)/verify-phone',
      params: {role},
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light">
      <View className="flex-1 justify-center items-center p-6">
        
        {/* Header Text */}
        <View className="text-center items-center mb-12">
          <Text className="text-4xl font-bold text-text-main">Are you a...</Text>
          <Text className="text-lg text-text-main mt-2">Choose your role to get started.</Text>
        </View>

        {/* Patient Selection Button */}
        <TouchableOpacity
          className="w-full bg-white p-6 rounded-xl border border-gray-200 flex-row items-center mb-4"
          onPress={() => handleSelection('patient')}
        >
          <Feather name="user" size={30} color="#007BFF" />
          <View className="ml-5">
            <Text className="text-xl font-bold text-text-main">Patient</Text>
            <Text className="text-base text-text-main mt-1">Book appointments & manage health.</Text>
          </View>
        </TouchableOpacity>

        {/* Provider Selection Button */}
        <TouchableOpacity
          className="w-full bg-white p-6 rounded-xl border border-gray-200 flex-row items-center"
          onPress={() => handleSelection('provider')}
        >
          <Feather name="briefcase" size={30} color="#28A745" />
          <View className="ml-5">
            <Text className="text-xl font-bold text-text-main">Provider</Text>
            <Text className="text-base text-text-main mt-1">Manage patients & appointments.</Text>
          </View>
        </TouchableOpacity>

      </View>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
};

export default SelectionScreen;