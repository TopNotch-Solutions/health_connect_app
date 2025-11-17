import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

const SignInScreen = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password.');
      return;
    }

    try {
      setIsLoading(true);
      const user = await login(email, password);
      // Don't manually navigate - let the root layout handle it automatically
      // The _layout.tsx will detect the authentication change and redirect to the correct home screen
      console.log('Login successful for user:', user.email, 'Role:', user.role);
    } catch(error: any){
      const message = error?.response?.data?.message || error?.message || 'Failed to sign in. Please check your credentials and try again.';
      Alert.alert('Login Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <View className="flex-1 px-6 justify-center">
        
        {/* Logo/Icon Section */}
        <View className="items-center mb-8">
          <Image 
            source={require('../../assets/images/healthconnectlogo.png')}
            style={{ width: 200, height: 200, marginBottom: 24 }}
            resizeMode="contain"
          />
          <Text className="text-4xl font-bold text-gray-900 mb-2">Welcome to HealthConnect</Text>
        </View>

        {/* Form Section */}
        <View className="mb-6">
          {/* Email Input */}
          <View className="mb-5">
            <Text className="text-base text-gray-700 mb-2 font-medium">Email</Text>
            <View className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 border-2 border-gray-300">
              <Feather name="mail" size={20} color="#3B82F6" />
              <TextInput
                className="flex-1 ml-3 text-base text-gray-900"
                placeholder="Enter your email"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Password Input */}
          <View className="mb-5">
            <Text className="text-base text-gray-700 mb-2 font-medium">Password</Text>
            <View className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 border-2 border-gray-300">
              <Feather name="lock" size={20} color="#3B82F6" />
              <TextInput
                className="flex-1 ml-3 text-base text-gray-900"
                placeholder="Enter your Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>
          </View>

          {/* Remember Me & Forgot Password */}
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity 
              onPress={() => setRememberMe(!rememberMe)}
              className="flex-row items-center"
            >
              <View className={`w-6 h-6 rounded border-2 mr-2 items-center justify-center ${rememberMe ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                {rememberMe && <Feather name="check" size={16} color="#FFFFFF" />}
              </View>
              <Text className="text-base text-gray-700">Remember me</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={() => router.push({ 
                pathname: '/(verification)/verify-phone', 
                params: { flow: 'resetPassword' } 
              })}
            >
              <Text className="text-base text-gray-700">Forgot Password?</Text>
            </TouchableOpacity>
          </View>

          {/* Sign In Button with Gradient Effect */}
          <TouchableOpacity
            className={`w-full py-5 rounded-2xl items-center justify-center ${isLoading ? 'bg-gray-400' : 'bg-gradient-to-r from-blue-500 to-purple-600'}`}
            style={{
              backgroundColor: isLoading ? '#9CA3AF' : '#3B82F6',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.2,
              shadowRadius: 8,
              elevation: 4,
            }}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text className="text-white text-center text-xl font-semibold">Log In</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Sign Up Link */}
        <View className="flex-row justify-center items-center mt-6">
          <Text className="text-gray-600 text-base">Don&apos;t have an account? </Text>
          <TouchableOpacity 
            onPress={() => router.push({pathname: '/selection', params: {mode: 'signup'}})}
          >
            <Text className="text-blue-600 font-semibold text-base">Sign Up</Text>
          </TouchableOpacity>
        </View>

      </View>
      <StatusBar backgroundColor="#EFF6FF" style="dark" />
    </SafeAreaView>
  );
};

export default SignInScreen;
