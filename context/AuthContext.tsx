// In context/AuthContext.tsx

import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../lib/api'; // Our Axios client

// Define the shape of our user object and context
interface User {
  _id: string;
  fullname: string;
  email: string;
  role: 'patient' | 'doctor' | 'nurse' | 'physiotherapist' | 'socialworker';
  // Add any other user properties you need from the backend response
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Create the AuthProvider component
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start as true to check for stored session

  // This effect runs when the app starts to check for a saved user session
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('user');
        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
      } catch (e) {
        console.error("Failed to load user from storage", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, []);

  // The login function that calls our backend
  const login = async (email: string, password: string) => {
    try {
      const response = await apiClient.post('/app/auth/login', { email, password });
      
      if (response.data && response.data.user) {
        const userData: User = response.data.user;
        setUser(userData);
        // Securely store the user data on the device
        await SecureStore.setItemAsync('user', JSON.stringify(userData));
        return userData;
      } else {
        // This handles cases where the API might return a 200 but no user data
        throw new Error('Login failed: Invalid response from server.');
      }
    } catch (error: any) {
      // Re-throw the error so the UI can catch it and show an alert
      console.error("Login failed:", error.response?.data?.message || error.message);
      throw error;
    }
  };

  // The logout function
  const logout = async (): Promise<void> => {
    setUser(null);
    // Remove the user data from secure storage
    await SecureStore.deleteItemAsync('user');
  };

  return (
    <AuthContext.Provider 
      value={{ 
        user, 
        isAuthenticated: !!user, 
        isLoading, 
        login, 
        logout 
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Create a custom hook to easily use the AuthContext in other components
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};