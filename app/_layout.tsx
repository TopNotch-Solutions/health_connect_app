// app/_layout.tsx

import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { AuthProvider, useAuth } from '../context/AuthContext';
import './globals.css';

const ProtectedLayout = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const rootSegment = (segments[0] as string | undefined) || '';

    // Routes that should only be reachable when logged IN
    const isProtectedGroup =
      rootSegment === '(patient)' ||
      rootSegment === '(provider)' ||
      rootSegment === '(tabs)' ||
      rootSegment === 'components';

    // Routes that are considered "public" (entry, auth, verification)
    const isPublicGroup =
      rootSegment === '' ||
      rootSegment === '(root)' ||
      rootSegment === '(auth)' ||
      rootSegment === '(verification)';

    // 1) If NOT authenticated but trying to access protected screens → send to sign-in
    if (!isAuthenticated && isProtectedGroup) {
      router.replace('/sign-in'); // file: app/(root)/sign-in.tsx
      return;
    }

    // 2) If authenticated and currently on a PUBLIC route → send them to the correct home
    if (isAuthenticated && isPublicGroup) {
      if (!user) return;

      if (user.role === 'patient') {
        // PATIENT ENTRY POINT
        router.replace('/(patient)/home'); // or '/(tabs)/home' if you switch to tabs
      } else if (
        user.role === 'doctor' ||
        user.role === 'nurse' ||
        user.role === 'physiotherapist' ||
        user.role === 'socialworker'
      ) {
        // ANY PROVIDER-TYPE ROLE
        router.replace('/(provider)/home');
      } else {
        // Fallback: if some weird role appears, just send them to sign-in for now
        router.replace('/sign-in');
      }
    }
  }, [isAuthenticated, isLoading, segments, router, user]);

  // While checking session, show a loader
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
        <ActivityIndicator size="large" color="#007BFF" />
      </View>
    );
  }

  // Normal navigation stack – groups are discovered automatically
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(root)" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(verification)" />
      <Stack.Screen name="(patient)" />
      <Stack.Screen name="(provider)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="components" />
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
