import {
  HeaderBackButton,
  iosHeaderLeftContainerStyle,
  iosStackHeaderBackOptions,
} from "../../components/HeaderBackButton";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React from "react";

const verificationHeaderOptions = {
  headerShadowVisible: false,
  headerStyle: {
    backgroundColor: "#F9FAFB",
  },
  headerTitleStyle: {
    fontWeight: "600" as const,
    fontSize: 18,
  },
  headerTintColor: "#111827",
  headerTitleAlign: "center" as const,
  ...iosStackHeaderBackOptions,
  headerLeftContainerStyle: iosHeaderLeftContainerStyle,
};

const VerificationLayout = () => {
  return (
    <>
      <Stack screenOptions={verificationHeaderOptions}>
        <Stack.Screen
          name="verify-phone"
          options={{
            headerTitle: "Verify Phone",
            headerLeft: () => <HeaderBackButton />,
          }}
        />
        <Stack.Screen
          name="verify-otp"
          options={{
            headerTitle: "Enter Code",
            headerLeft: () => <HeaderBackButton />,
          }}
        />
      </Stack>
      <StatusBar backgroundColor="#F9FAFB" style="dark" />
    </>
  );
};

export default VerificationLayout;
