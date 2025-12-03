import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Text, TextInput, TouchableOpacity, View, Image } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';

const SignInScreen = () => {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  
  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Start animations on mount
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.loop(
        Animated.sequence([
          Animated.timing(rotateAnim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(rotateAnim, {
            toValue: 0,
            duration: 3000,
            useNativeDriver: true,
          }),
        ])
      ),
    ]).start();
  }, []);

  const handleSignIn = async () => {
    // Clear previous errors
    setEmailError('');
    setPasswordError('');
    
    // Validate inputs
    let hasError = false;
    
    if (!email) {
      setEmailError('Email is required');
      hasError = true;
    } else if (!email.includes('@') || !email.includes('.')) {
      setEmailError('Please enter a valid email address');
      hasError = true;
    }
    
    if (!password) {
      setPasswordError('Password is required');
      hasError = true;
    }
    
    if (hasError) {
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

  const handleEmailChange = (text: string) => {
    setEmail(text);
    if (emailError) {
      setEmailError('');
    }
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    if (passwordError) {
      setPasswordError('');
    }
  };

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '5deg'],
  });

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <KeyboardAwareScrollView
        contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingTop: 20, paddingBottom: 16, justifyContent: 'space-between' }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        extraScrollHeight={150}
      >
        
        {/* Logo/Icon Section */}
        <View className="items-center mb-4">
          <Image 
            source={require('../../assets/images/healthconnectlogo-cropped.png')}
            style={{ width: 180, height: 180, marginBottom: 16 }}
            resizeMode="contain"
          />
        </View>

        {/* Form Section */}
        <View className="mb-4">
          <Text className="text-2xl mb-2 font-bold text-gray-500">Welcome</Text>
          {/* Email Input */}
          <View className="mb-5">
            <Text className="text-base text-gray-700 mb-2 font-medium">Email</Text>
            <View className="flex-row items-center bg-white rounded-2xl px-4 py-3.5 border-2 border-gray-300">
              <MaterialCommunityIcons name="email" size={20} color="#10B981" />
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
            <View className="mb-4">
              <Text className="text-base text-gray-700 mb-2 font-medium">Password</Text>
              <View 
                className="flex-row items-center bg-white rounded-2xl px-5 py-4 border-2"
                style={{
                  borderColor: passwordError ? '#EF4444' : '#D1D5DB',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2,
                }}
              >
                <MaterialCommunityIcons name="lock" size={20} color={passwordError ? '#EF4444' : '#10B981'} />
                <TextInput
                  className="flex-1 ml-3 text-base text-gray-900"
                  placeholder="Enter your password"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                />
                <TouchableOpacity 
                  onPress={() => setShowPassword(!showPassword)}
                  className="ml-3"
                >
                  <Feather name={showPassword ? "eye" : "eye-off"} size={20} color="#6B7280" />
                </TouchableOpacity>
              </View>
              {passwordError ? (
                <Text className="text-red-500 text-sm mt-1 ml-1">{passwordError}</Text>
              ) : null}
            </View>

            {/* Forgot Password */}
            <View className="flex-row justify-end mb-4">
              <TouchableOpacity 
                onPress={() => router.push({ 
                  pathname: '/(verification)/verify-phone', 
                  params: { flow: 'resetPassword' } 
                })}
              >
                <Text className="text-base text-green-600 font-medium">Forgot Password?</Text>
              </TouchableOpacity>
            </View>

            {/* Sign Up Link */}
            <View className="flex-row justify-center items-center">
              <Text className="text-gray-600 text-base">Don&apos;t have an account? </Text>
              <TouchableOpacity 
                onPress={() => router.push({pathname: '/selection', params: {mode: 'signup'}})}
              >
                <Text className="text-green-600 font-semibold text-base">Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAwareScrollView>

        {/* Section 4: Login Button - Fixed at bottom with safe area */}
        <SafeAreaView edges={['bottom']} className="px-6 pb-4">
          <TouchableOpacity
            className="w-full py-5 rounded-2xl items-center justify-center"
            style={{
              backgroundColor: isLoading ? '#9CA3AF' : '#10B981',
              shadowColor: '#10B981',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
            }}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View className="flex-row items-center">
                <Text className="text-white text-xl font-semibold mr-2">Log In</Text>
                <Feather name="arrow-right" size={20} color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>
        </SafeAreaView>
      <StatusBar backgroundColor="#EFF6FF" style="dark" />
    </SafeAreaView>
  );
};

export default SignInScreen;
