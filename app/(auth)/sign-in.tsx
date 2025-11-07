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

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    try {
      // Call the login function from the context
      await login(email, password);
      
      // On success, the ProtectedLayout in `app/_layout.tsx` will automatically
      // handle redirecting the user to the home screen.

    } catch (error: any) {
      // The context's login function re-throws the error, so we can catch it here
      // to show a specific message to the user.
      const errorMessage = error.response?.data?.message || 'Login failed. Please check your credentials and try again.';
      Alert.alert('Login Failed', errorMessage);
    } finally {
      setIsLoading(false);
    }
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
          <TouchableOpacity onPress={() => router.push('/selection')}>
            <Text className="text-primary font-bold text-base">Create an account</Text>
          </TouchableOpacity>
        </View>

      </View>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </SafeAreaView>
  );
};

export default SignInScreen;