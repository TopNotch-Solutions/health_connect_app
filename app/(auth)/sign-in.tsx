import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext'; // Import the useAuth hook

const SignInScreen = () => {
  const router = useRouter();
  const { login } = useAuth(); // Get the login function from our context
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Local loading state for the button

  const displayNameFromEmail = (e: string) => {
  const base = (e || "").split("@")[0] || "Patient";
  return base
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
};

const handleSignIn = () => {
  if (!email || !password) {
    Alert.alert('Error', 'Please enter both email and password.');
    return;
  }

  // Simulated success
  console.log('Attempting to sign in with:', { email, password });
  Alert.alert('Success (Simulated)', 'You are now signed in!');

  // Go straight to the home screen with a name param
  router.replace({
    pathname: "/(app)/patient-home",
    params: { name: displayNameFromEmail(email) },
  });
};

  return (
    <SafeAreaView className="flex-1">
      <View className="flex-1 justify-center p-6">
        
        {/* Header Section */}
        <View className="mb-12">
          <Text className="text-4xl font-bold text-text-main">Welcome Back</Text>
          <Text className="text-lg text-text-main mt-2">Sign in to your account</Text>
        </View>

        {/* Form Section */}
        <View className="mb-6">
          <Text className="text-base text-text-main mb-2 font-semibold">Email Address</Text>
          <TextInput
            className="w-full bg-white p-4 rounded-xl text-base border border-gray-200"
            placeholder="youremail@example.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
        </View>

        <View className="mb-8">
          <Text className="text-base text-text-main mb-2 font-semibold">Password</Text>
          <TextInput
            className="w-full bg-white p-4 rounded-xl text-base border border-gray-200"
            placeholder="Enter your password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry // This hides the password characters
          />
        </View>

         <View className="w-full items-end mb-8">
            <TouchableOpacity onPress={() =>  router.push({ pathname: '/(verification)/verify-phone', params: { flow: 'resetPassword' } })
}>
                <Text className="text-primary font-semibold">Forgot Password?</Text>
            </TouchableOpacity>
        </View>

        {/* Sign In Button with Loading State */}
        <TouchableOpacity
          className={`w-full p-4 rounded-xl flex-row justify-center items-center ${isLoading ? 'bg-gray-400' : 'bg-primary'}`}
          onPress={handleSignIn}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text className="text-white text-center text-lg font-semibold">Sign In</Text>
          )}
        </TouchableOpacity>

        {/* Link to Go Back to Role Selection */}
        <View className="flex-row justify-center mt-8">
          <Text className="text-text-main text-base">New user? </Text>
          <TouchableOpacity 
            onPress={() => router.push({pathname: '/selection', params: {mode: 'signup'}})}>
            <Text className="text-primary font-bold text-base">Create an account</Text>
          </TouchableOpacity>
        </View>

      </View>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
};

export default SignInScreen;