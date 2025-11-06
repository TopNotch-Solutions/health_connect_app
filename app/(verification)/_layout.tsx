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
            headerTitle: 'Verify Your Number',
            headerShadowVisible: false, // For a cleaner look
            headerStyle: { backgroundColor: '#E9F7EF' }, // Matches our app background
          }} 
        />
        <Stack.Screen 
          name="verify-otp" 
          options={{ 
            headerTitle: 'Enter Code',
            headerShadowVisible: false,
            headerStyle: { backgroundColor: '#E9F7EF' },
          }} 
        />
      </Stack>
      <StatusBar backgroundColor="#E9F7EF" style="dark" />
    </>
  );
};

export default VerificationLayout;