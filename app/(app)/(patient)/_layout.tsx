import { Feather } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";

export default function PatientTabLayout() {
  const activeColor = '#007BFF';
  const inactiveColor = '#6C757D';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        tabBarShowLabel: true, 
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          height: 64,
          paddingTop: 6,
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 6,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerShown: false,
          tabBarIcon: ({color, size}) => <Feather name="home" color={color} size={size}/>
        }}
      />
      <Tabs.Screen 
        name="waiting-room"
        options={{
          title: "Waiting Room",
          tabBarIcon: ({color, size}) => <Feather name="clock" color={color} size={size}/>
        }}
      />
      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({color, size}) => <Feather name="credit-card" color={color} size={size}/>
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: "Issues",
          tabBarIcon: ({color, size}) => <Feather name="user" color={color} size={size}/>
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({color, size}) => <Feather name="user" color={color} size={size}/>
        }}
      />
    </Tabs>
  );
}