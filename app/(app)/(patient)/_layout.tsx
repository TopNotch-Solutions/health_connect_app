import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React from "react";

export default function PatientTabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: true, 
        tabBarStyle: {
          height: 64,
          paddingTop: 6
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({color, size}) => (
            <Feather name="home" color={color} size={size}/>
          )
        }}
      />
      <Tabs.Screen 
        name="waiting-room"
        options={{
          title: "Waiting Room",
          tabBarIcon: ({color, size}) => (
            <Feather name="clock" color={color} size={size}/>
          )
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({color, size}) => (
            <Feather name="credit-card" color={color} size={size}/>
          )
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: "Issues",
          tabBarIcon: ({color, size}) => (
            <Feather name="user" color={color} size={size}/>
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({color, size}) => (
            <Feather name="user" color={color} size={size}/>
          )
        }}
      />
    </Tabs>
  );
}