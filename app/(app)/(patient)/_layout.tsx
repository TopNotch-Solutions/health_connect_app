// In app/(patient)/_layout.tsx

import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';

export default function PatientTabLayout() {
  const activeColor = '#007BFF'; // Our primary color
  const inactiveColor = '#6C757D'; // Our text-main color

  return (
    <Tabs
      screenOptions={{
        // --- 1. SET THE COLORS ---
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        
        // --- 2. MAKE SURE LABELS ARE VISIBLE ---
        tabBarShowLabel: true, 

        // --- 3. STYLE THE TAB BAR AND LABELS ---
        tabBarStyle: {
          backgroundColor: '#FFFFFF', // White background
          height: 60, // A standard, comfortable height
          borderTopWidth: 1, // Add a subtle top border
          borderTopColor: '#E5E7EB', // A light gray border color
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 5,
        },
        tabBarIconStyle: {
          marginTop: 5,
        },

        // --- 4. CONFIGURE THE HEADERS ---
        headerShown: false, // Default to false, enable on screens that need it
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <Feather name="home" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Appointments',
          headerShown: true, // We want a header on this screen
          tabBarIcon: ({ color }) => <Feather name="calendar" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          headerShown: true, // And on this one
          tabBarIcon: ({ color }) => <Feather name="clock" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: true, // And this one
          tabBarIcon: ({ color }) => <Feather name="user" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}