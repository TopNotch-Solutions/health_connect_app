import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { AUTH_COLORS } from "../../lib/authScreenTheme";

const VerificationLayout = () => {
  return (
    <>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: AUTH_COLORS.bg },
        }}
      >
        <Stack.Screen name="verify-phone" />
        <Stack.Screen name="verify-otp" />
      </Stack>
      <StatusBar backgroundColor={AUTH_COLORS.bg} style="dark" />
    </>
  );
};

export default VerificationLayout;
