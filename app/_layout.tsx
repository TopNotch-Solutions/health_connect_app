// In app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import './globals.css';


const ProtectedLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // Use setTimeout to ensure state updates have completed
    const timeout = setTimeout(() => {
      const inAuth = segments[0] === '(auth)';
      const inVerification = segments[0] === '(verification)';
      const inRoot = segments[0] === '(root)';
      const inApp = segments[0] === '(app)';

      if (!isAuthenticated) {
        // User is not authenticated
        if (inApp) {
          // Trying to access protected app routes, redirect to selection
          router.replace('/(root)/selection');
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
    }, 100);

    return () => clearTimeout(timeout);
  }, [isAuthenticated, isLoading, segments, router, user?.role]);

  if (isLoading) {
    return (
      <View style={{ 
          flex: 1, 
          justifyContent: 'center', 
          alignItems: 'center', 
          backgroundColor: '#E9F7EF' 
        }}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(root)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(verification)" />
      <Stack.Screen name="(app)" />
    </Stack>
  );
};

export default function RootLayout() {
  return (
     <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <ProtectedLayout />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}