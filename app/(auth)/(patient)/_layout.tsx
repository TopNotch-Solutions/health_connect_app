import { Stack } from 'expo-router';
import React from 'react';
import '../../globals.css';

const AuthLayout = () => {
  // This removes the default header for all screens in the (auth) group
  // so we can have a clean, custom UI.
  return <Stack screenOptions={
    { headerShown: false }
  }/>;
};

export default AuthLayout;