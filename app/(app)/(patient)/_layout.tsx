import {
  HeaderBackButton,
  iosStackHeaderBackOptions,
} from "@/components/HeaderBackButton";
import { Stack } from "expo-router";
import React from "react";

/**
 * SDK 58: secondary screens live on a Stack above Tabs.
 * Using `href: null` inside Tabs makes routes unreachable, so all_ailments /
 * recent-activities / etc. are stack screens instead of hidden tabs.
 */
export const unstable_settings = {
  anchor: "(tabs)",
};

export default function PatientLayout() {
  return (
    <Stack screenOptions={{ ...iosStackHeaderBackOptions, headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="all_ailments"
        options={{
          headerShown: true,
          // SDK 58 / iOS 26+: default header is transparent and content draws under it
          headerTransparent: false,
          headerStyle: { backgroundColor: "#F9FAFB" },
          title: "",
          headerLeft: () => <HeaderBackButton size={30} />,
        }}
      />
      <Stack.Screen
        name="ailments"
        options={{
          headerShown: true,
          headerTransparent: false,
          headerStyle: { backgroundColor: "#F9FAFB" },
          title: "",
        }}
      />
      <Stack.Screen
        name="recent-activities"
        options={{
          headerShown: true,
          // SDK 58 / iOS 26+: default header is transparent and content draws under it
          headerTransparent: false,
          headerStyle: { backgroundColor: "#FAFFFE" },
          title: "",
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
