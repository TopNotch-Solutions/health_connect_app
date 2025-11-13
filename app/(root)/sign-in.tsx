import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

const SignInScreen = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const displayNameFromEmail = (e: string) => {
    const base = (e || "").split("@")[0] || "Patient";
    return base
      .replace(/[._-]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await login(email, password);
      const displayName = user.fullname || displayNameFromEmail(user.email);
      if (user.role === 'patient'){
        router.replace({
          pathname: '/(patient)/home',
          params: {name: displayName},
        });
      } else if(
        user.role === 'doctor' || 
        user.role === 'nurse' || 
        user.role === 'physiotherapist' || 
        user.role === 'socialworker'
      ){
        router.replace('/(provider)/home')
      } else {
        Alert.alert('Login Error',`Unsported user role: ${user.role}`);
      }
    } catch(error: any){
      const message = error?.response?.data?.message || error?.message || 'Failed to sign in. Please check your credentials and try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setIsLoading(false);
    }
    console.log('Attempting to sign in with:', { email, password });
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-1 px-6 pt-8">
        
        {/* Header Section */}
        <View className="mb-10">
          <Text className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</Text>
          <Text className="text-base text-gray-600">Sign in to your account</Text>
        </View>

        {/* Form Section */}
        <View className="space-y-5">
          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Email Address</Text>
            <TextInput
              className="w-full bg-white px-4 py-3.5 rounded-lg text-base border border-gray-300 text-gray-900"
              placeholder="youremail@example.com"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View>
            <Text className="text-sm font-medium text-gray-700 mb-2">Password</Text>
            <TextInput
              className="w-full bg-white px-4 py-3.5 rounded-lg text-base border border-gray-300 text-gray-900"
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
          </View>

          {/* Forgot Password Link */}
          <View className="w-full items-end pt-1">
            <TouchableOpacity 
              onPress={() => router.push({ 
                pathname: '/(verification)/verify-phone', 
                params: { flow: 'resetPassword' } 
              })}
            >
              <Text className="text-blue-600 font-semibold text-sm">Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button */}
          <TouchableOpacity
            className={`w-full py-4 rounded-lg mt-4 ${isLoading ? 'bg-gray-400' : 'bg-blue-600'}`}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white text-center text-base font-semibold">Sign In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View className="flex-row justify-center items-center mt-8">
          <Text className="text-gray-600 text-sm">Don't have an account? </Text>
          <TouchableOpacity 
            onPress={() => router.push({pathname: '/selection', params: {mode: 'signup'}})}
          >
            <Text className="text-blue-600 font-semibold text-sm">Sign Up</Text>
          </TouchableOpacity>
        </View>

      </View>
      <StatusBar backgroundColor="#F9FAFB" style="dark" />
    </SafeAreaView>
  );
};

export default SignInScreen;