import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const SignInScreen = () => {
  const router = useRouter();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const handleSignIn = () => {
    // --- THIS IS WHERE YOU'LL CONNECT TO YOUR BACKEND ---
    // For now, we'll simulate the action.
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }
    console.log('Attempting to sign in with:', { email, password });
    Alert.alert('Success (Simulated)', 'You are now signed in!');
    // On a real success, you would navigate to the main app like this:
    // router.replace('/home'); 
  };

  return (
    <SafeAreaView className="flex-1 bg-background-light">
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

        {/* Sign In Button */}
        <TouchableOpacity
          className="w-full bg-primary p-4 rounded-xl"
          onPress={handleSignIn}
        >
          <Text className="text-white text-center text-lg font-semibold">Sign In</Text>
        </TouchableOpacity>

        {/* Link to Registration Screen */}
        <View className="flex-row justify-center mt-8">
          <Text className="text-text-main text-base">Don&apos;t have an account? </Text>
          <TouchableOpacity onPress={() => router.push('/registration')}>
            <Text className="text-primary font-bold text-base">Register</Text>
          </TouchableOpacity>
        </View>

      </View>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
};

export default SignInScreen;