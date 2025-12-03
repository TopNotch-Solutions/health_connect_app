import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';

const VerificationLayout = () => {
  return (
    <>
      <Stack>
        <Stack.Screen 
          name="verify-phone" 
          options={{ 
            headerTitle: 'Back',
            headerShadowVisible: false,
            headerStyle: { 
              backgroundColor: '#F9FAFB',
            },
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
            headerTintColor: '#111827',
          }} 
        />
        <Stack.Screen 
          name="verify-otp" 
          options={{ 
            headerTitle: 'Enter Code',
            headerShadowVisible: false,
            headerStyle: { 
              backgroundColor: '#F9FAFB',
            },
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
            headerTintColor: '#111827',
          }} 
        />
      </Stack>
      <StatusBar backgroundColor="#F9FAFB" style="dark" />
    </>
  );
};

export default VerificationLayout;