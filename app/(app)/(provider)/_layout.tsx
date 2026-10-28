import {
  HeaderBackButton,
  iosStackHeaderBackOptions,
} from "@/components/HeaderBackButton";
import { Stack } from "expo-router";
import React from "react";

/**
 * SDK 58: secondary screens live on a Stack above Tabs.
 * Using `href: null` inside Tabs makes routes unreachable.
 */
export const unstable_settings = {
  anchor: "(tabs)",
};

export default function ProviderLayout() {
  return (
    <Stack screenOptions={{ ...iosStackHeaderBackOptions, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="transactions"
        options={{
          headerShown: true,
          // SDK 58 / iOS 26+: default header is transparent and content draws under it
          headerTransparent: false,
          headerStyle: { backgroundColor: "#F9FAFB" },
          title: "Transaction History",
          headerLeft: () => <HeaderBackButton size={30} />,
        }}
      />
      <Stack.Screen
        name="medical-aid"
        options={{
          headerShown: true,
          // SDK 58 / iOS 26+: default header is transparent and content draws under it
          headerTransparent: false,
          headerStyle: { backgroundColor: "#FAFFFE" },
          title: "Medical Aid",
          headerLeft: () => <HeaderBackButton size={30} />,
        }}
      />
      <Stack.Screen
        name="teleconsultation-call"
        options={{ headerShown: false }}
      />
    </Stack>
  );
}
