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
            headerShadowVisible: true, // For a cleaner look
            headerStyle: { backgroundColor: '#ffffffff' }, // Matches our app background
          }} 
        />
        <Stack.Screen 
          name="verify-otp" 
          options={{ 
            headerTitle: 'Enter Code',
            headerShadowVisible: true,
            headerStyle: { backgroundColor: '#ffffffff' },
          }} 
        />
      </Stack>
      <StatusBar backgroundColor="#ffffffff" style="dark" />
    </>
  );
};

export default VerificationLayout;