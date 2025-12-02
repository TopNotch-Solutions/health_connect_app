import { Stack } from 'expo-router';

export default function OnboardingLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="onboarding-patient" />
      <Stack.Screen name="onboarding-provider" />
      <Stack.Screen name="onboarding-summary" />
    </Stack>
  );
}
