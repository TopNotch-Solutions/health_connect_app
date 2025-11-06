import { Stack } from 'expo-router';
import './globals.css';

const RootLayout = () => {
  return (
    <Stack>
      {/* The Onboarding screen */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* The (auth) group */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      
      {/* The (tabs) group for the main app */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

    </Stack>
  );
};

export default RootLayout;