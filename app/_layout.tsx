// In app/_layout.tsx
import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import 'react-native-gesture-handler';
import { AuthProvider, useAuth } from '../context/AuthContext'; // 1. Import AuthProvider and useAuth
import './globals.css';

// This is the protected layout component that will decide which screen to show.
// It contains both the route protection logic AND your original Stack navigator.
const ProtectedLayout = () => {
  const { isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return; // Don't run logic until session check is complete

    const inApp = segments[0] === '(patient)'; // Are we trying to access the main patient app?

    if (!isAuthenticated && inApp) {
      // If the user is NOT authenticated but is trying to access the patient screens,
      // redirect them to the sign-in page.
      router.replace('/selection'); 
    } else if (isAuthenticated && !inApp) {
      // If the user IS authenticated but is currently outside the patient screens 
      // (e.g., on the sign-in or onboarding page), send them to the patient home.
      router.replace('/(patient)/home');
    }
  }, [isAuthenticated, isLoading, segments, router]);

  // While we are checking if a user is logged in, show a loading spinner.
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#E9F7EF' }}>
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  // If loading is complete, render the navigation stack.
  // The useEffect hook above will handle the redirection.
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(verification)" />
      <Stack.Screen name="(patient)" />
      <Stack.Screen name="(provider)" />
    </Stack>
  );
};

// This remains the root layout component for your app.
export default function RootLayout() {
  return (
    // We wrap our entire navigation structure with the AuthProvider.
    <AuthProvider>
      <ProtectedLayout />
    </AuthProvider>
  );
}