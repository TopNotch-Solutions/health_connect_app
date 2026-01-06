import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import apiClient from '../lib/api';
import socketService from '../lib/socket';
import { Alert } from 'react-native/Libraries/Alert/Alert';

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
  nationalId?: string;
  isAccountVerified?: boolean;
}

// Session timeout duration: 5 minutes in milliseconds
const SESSION_TIMEOUT = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivityTime';

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
  const appState = useRef(AppState.currentState);

  // Update last activity timestamp
  const updateLastActivity = useCallback(async () => {
    const timestamp = Date.now().toString();
    await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, timestamp);
  }, []);

  // Logout function
  const logout = useCallback(async () => {
    try {
      // Disconnect the socket before logging out
      socketService.disconnect();
      
      setUser(null);
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync(LAST_ACTIVITY_KEY);
    } catch (error) {
      console.error("Failed to logout:", error);
      // Even if storage deletion fails, clear the user state
      setUser(null);
    }
  }, []);

  // Check if session has expired
  const checkSessionTimeout = useCallback(async () => {
    try {
      const lastActivity = await SecureStore.getItemAsync(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
          // Session expired, log out user
          console.log('Session expired after 5 minutes of inactivity');
          await logout();
          return true; // Session expired
        }
      }
      return false; // Session still valid
    } catch (e) {
      console.error("Failed to check session timeout", e);
      return false;
    }
  }, [logout]);

  // This effect runs on app startup to load a saved session
  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('user');
        if (storedUser) {
          // Check if session has expired
          const expired = await checkSessionTimeout();
          if (!expired) {
            setUser(JSON.parse(storedUser));
            // Update activity timestamp on app start
            await updateLastActivity();
          }
        }
      } catch (e) {
        console.error("Failed to load user from storage", e);
      } finally {
        setIsLoading(false);
      }
    };
    loadUser();
  }, [checkSessionTimeout, updateLastActivity]);

  // Monitor app state changes (foreground/background)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        user // Only check if user is logged in
      ) {
        // App has come to the foreground
        const expired = await checkSessionTimeout();
        if (!expired) {
          // Session still valid, update timestamp
          await updateLastActivity();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [user, checkSessionTimeout, updateLastActivity]);

  useEffect(() => {
    const fetchAppToken = async () => {
      try {
        const existingToken = await SecureStore.getItemAsync('appToken');
        if (!existingToken) {
          const response = await apiClient.get('http://13.51.207.99:4000/api/app/auth/retrieve-jwt-token');
          const data = await response.data;

          console.log("Fetch app token", data);

          if (data && data.token) {
            await SecureStore.setItemAsync('appToken', data.token);
          }
        }
      } catch (error) {
        console.error("Failed to fetch app token:", error);
      }
    };
    fetchAppToken();
  }, []);
  // Login function
  // Login function in AuthContext.tsx
const login = async (email: string, password: string): Promise<User> => {
  try {
    // Make the API call first
    const response = await apiClient.post('/app/auth/login', { 
      email, 
      password,
    });
    
    console.log('Login response:', response.data); // Debug log
    
    if (response.data && response.data.user) {
      const userDataWithToken = response.data.user;
      
      // Extract the token
      const token = userDataWithToken.token;
      
      if (!token) {
        console.error('Token not found in response:', userDataWithToken);
        throw new Error('Login failed: No token received from server.');
      }
      
      // Create userData without the token property
      const userData: User = {
        userId: userDataWithToken.userId,
        fullname: userDataWithToken.fullname,
        email: userDataWithToken.email,
        role: userDataWithToken.role,
        cellphoneNumber: userDataWithToken.cellphoneNumber,
        walletID: userDataWithToken.walletID,
        gender: userDataWithToken.gender,
        dateOfBirth: userDataWithToken.dateOfBirth,
        balance: userDataWithToken.balance,
        profileImage: userDataWithToken.profileImage,
        address: userDataWithToken.address,
        region: userDataWithToken.region,
        town: userDataWithToken.town,
        nationalId: userDataWithToken.nationalId,
        isAccountVerified: userDataWithToken.isAccountVerified,
      };
      
      // Clear old data and set new user atomically to avoid race conditions
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('authToken');

      await SecureStore.setItemAsync('user', JSON.stringify(userData));
      await SecureStore.setItemAsync('authToken', token);
      
      console.log('Token saved successfully:', token.substring(0, 20) + '...'); // Debug log
      
      // Set initial activity timestamp
      await updateLastActivity();
      setUser(userData);
      
      return userData;
    } else {
      throw new Error('Login failed: Invalid response from server.');
    }
  } catch (error: any) {
    console.error("Login failed:", error.response?.data?.message || error.message);
    console.error("Full error:", error); // More detailed error log
    setUser(null);
    await SecureStore.deleteItemAsync('user').catch(() => {});
    await SecureStore.deleteItemAsync('authToken').catch(() => {});
    throw error;
  }
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