import { Stack } from 'expo-router';

const RootLayout = () => {
  return (
    <Stack>
      {/* The Onboarding screen */}
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* The (auth) group */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      
      {/* The (tabs) group for the main app */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Add other screens/groups here if needed */}
    </Stack>
  );
};

export default RootLayout;