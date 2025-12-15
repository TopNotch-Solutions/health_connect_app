// In app/_layout.tsx
import { Feather } from '@expo/vector-icons';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Animated, Image, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import GlobalRouteModal from '../components/(provider)/GlobalRouteModal';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { RouteProvider } from '../context/RouteContext';
import { usePushNotifications } from '../hooks/usePushNotifications';
import './globals.css';

// Import splash image
const splashImage = require('../assets/images/splashscreen_image.jpg');

// Simple in-app splash screen that fades in on app open for both patients and providers
const IntroSplash = () => {
  const opacity = useState(new Animated.Value(0))[0];
  const translateY = useState(new Animated.Value(40))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 700,
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <View
      style={[
        StyleSheet.absoluteFillObject,
        {
          backgroundColor: '#000',
          zIndex: 999,
          flexDirection: 'column',
        },
      ]}
    >
      {/* Top half: splash image */}
      <View style={{ flex: 1, overflow: 'hidden' }}>
        <Image
          source={splashImage}
          style={{
            width: '100%',
            height: '100%',
          }}
          resizeMode="cover"
        />
        {/* Subtle overlay to keep tone consistent */}
        <View
          style={{
            ...StyleSheet.absoluteFillObject,
            backgroundColor: 'rgba(0, 0, 0, 0.25)',
          }}
        />
      </View>

      {/* Bottom half: animated text block */}
      <View
        style={{
          flex: 1,
          backgroundColor: '#FFFFFF',
          paddingHorizontal: 32,
          paddingBottom: 40,
          paddingTop: 24,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Animated.View
          style={{
            opacity,
            transform: [{ translateY }],
          }}
        >
          <Text
            style={{
              fontSize: 30,
              fontWeight: '700',
              marginBottom: 12,
              color: '#0F172A', // very dark for strong visibility
              textAlign: 'center',
            }}
          >
            HealthConnect
          </Text>
          <Text
            style={{
              fontSize: 16,
              fontWeight: '600',
              marginBottom: 8,
              color: '#374151', // text-gray-700 for better contrast
              textAlign: 'center',
            }}
          >
            One place to coordinate care, stay informed, and feel supported every step of the way.
          </Text>

          {/* Feature bullets similar to onboarding-patient.tsx */}
          <View
            style={{
              width: '100%',
              marginTop: 16,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#DCFCE7', // bg-green-100
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="check" size={20} color="#10B981" />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#808080', // slightly lighter than #0F172A
                  flexShrink: 1,
                }}
              >
                Easy access to trusted healthcare when you need it
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#DCFCE7',
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="check" size={20} color="#10B981" />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#808080', // slightly lighter than #0F172A
                  flexShrink: 1,
                }}
              >
                Clear, secure information about your health journey
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View
                style={{
                  width: 40,
                  height: 40,
                  backgroundColor: '#DCFCE7',
                  borderRadius: 20,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12,
                }}
              >
                <Feather name="check" size={20} color="#10B981" />
              </View>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: '600',
                  color: '#808080', // very dark, highly visible
                  flexShrink: 1,
                }}
              >
                Smarter tools for planning, tracking, and peace of mind
              </Text>
            </View>
          </View>
        </Animated.View>
      </View>
    </View>
  );
};

const ProtectedLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const [showIntroSplash, setShowIntroSplash] = useState(true);
  
  try {
    usePushNotifications();
  } catch (error) {
    console.error('Error in usePushNotifications:', error);
  }

  // Hide the intro splash a short moment after auth state is known
  useEffect(() => {
    if (isLoading) return;

    const timeout = setTimeout(() => {
      setShowIntroSplash(false);
    }, 7000);

    return () => clearTimeout(timeout);
  }, [isLoading]);

  useEffect(() => {
    if (isLoading) return;

    // Use setTimeout to ensure state updates have completed
    const timeout = setTimeout(() => {
      try {
        const inAuth = segments[0] === '(auth)';
        const inVerification = segments[0] === '(verification)';
        const inRoot = segments[0] === '(root)';
        const inApp = segments[0] === '(app)';

        if (!isAuthenticated) {
          // User is not authenticated
          if (inApp) {
            // Trying to access protected app routes, redirect to sign-in
            router.replace('/(root)/sign-in');
          }
        } else {
          // User is authenticated
          if (inAuth || inVerification || inRoot) {
            // User is logged in but on auth/verification/root screens
            // Redirect based on user role
            if (user?.role === 'patient') {
              router.replace('/(app)/(patient)/home');
            } else if (
              user?.role === 'doctor' || 
              user?.role === 'nurse' || 
              user?.role === 'physiotherapist' || 
              user?.role === 'socialworker'
            ) {
              router.replace('/(app)/(provider)/home');
            } else {
              // Fallback if role is not set
              console.warn('User has unknown role:', user?.role);
              router.replace('/(root)/selection');
            }
          } else if (inApp) {
            // User is in app section, verify they're in the correct role section
            const inPatient = segments[1] === '(patient)';
            const inProvider = segments[1] === '(provider)';
            
            if (user?.role === 'patient' && inProvider) {
              // Patient trying to access provider area
              router.replace('/(app)/(patient)/home');
            } else if (
              (user?.role === 'doctor' || 
               user?.role === 'nurse' || 
               user?.role === 'physiotherapist' || 
               user?.role === 'socialworker') && 
              inPatient
            ) {
              // Provider trying to access patient area
              router.replace('/(app)/(provider)/home');
            }
          }
        }
      } catch (error) {
        console.error('Error in ProtectedLayout routing logic:', error);
      }
    }, 100);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, isLoading, segments, router, user?.role]);

  if (isLoading) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: '#E9F7EF',
        }}
      >
        <ActivityIndicator size="large" color="#16A34A" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {showIntroSplash && <IntroSplash />}
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(root)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(verification)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </View>
  );
};

export default function RootLayout() {
  return (
     <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RouteProvider>
          <ProtectedLayout />
          <GlobalRouteModal />
        </RouteProvider>
      </AuthProvider>
    </GestureHandlerRootView>
  );
}