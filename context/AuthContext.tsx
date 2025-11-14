import * as SecureStore from 'expo-secure-store';
import React, { createContext, useContext, useEffect, useState } from 'react';
import apiClient from '../lib/api';

// --- The corrected and expanded User interface ---
export interface User { // Exporting the interface so other files can use it
  userId: string;
  fullname: string;
  email: string;
  role: 'patient' | 'provider' | 'doctor' | 'nurse' | 'physiotherapist' | 'socialworker';
  cellphoneNumber?: string;
  walletID?: string;
  gender?: 'Male' | 'Female' | 'Other';
  dateOfBirth?: string;
  balance?: number;
  profileImage?: string;
  address?: string;
  region?: string;
  town?: string;
  isAccountVerified?: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateUser: (updatedUserData: Partial<User>) => Promise<void>; // New function to update user state
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // This effect runs on app startup to load a saved session
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

  // Login function
  const login = async (email: string, password: string): Promise<User> => {
    try {
      // Corrected: Removed all fcmToken logic
      const response = await apiClient.post('/app/auth/login', { 
        email, 
        password,
      });
      
      if (response.data && response.data.user) {
        const userData: User = response.data.user;
        setUser(userData);
        await SecureStore.setItemAsync('user', JSON.stringify(userData));
        return userData;
      } else {
        throw new Error('Login failed: Invalid response from server.');
      }
    } catch (error: any) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      throw error;
    }
  };

  // Logout function
  const logout = async () => {
    setUser(null);
    await SecureStore.deleteItemAsync('user');
  };
  
  // --- NEW: Function to update the user's state after actions like a transaction ---
  const updateUser = async (updatedUserData: Partial<User>) => {
    // Only proceed if there is a current user
    if (!user) return; 

    const newUser = { ...user, ...updatedUserData };
    setUser(newUser);
    await SecureStore.setItemAsync('user', JSON.stringify(newUser));
  };

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, isLoading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};