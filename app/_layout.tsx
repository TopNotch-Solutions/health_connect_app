// In app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext';
import './globals.css';

const ProtectedLayout = () => {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

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
        } else if (user?.role === 'doctor') {
          router.replace('/(app)/(provider)/home');
        } else {
          // Fallback if role is not set
          router.replace('/(root)/selection');
        }
      }
    }
  }, [isAuthenticated, isLoading, segments, router, user]);

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
    <AuthProvider>
      <ProtectedLayout />
    </AuthProvider>
  );
}