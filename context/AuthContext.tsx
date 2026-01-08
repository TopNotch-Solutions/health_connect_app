import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import apiClient from '../lib/api';
import socketService from '../lib/socket';

export interface User {
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
  isPushNotificationEnabled?: boolean;
}

const SESSION_TIMEOUT = 5 * 60 * 1000;
const LAST_ACTIVITY_KEY = 'lastActivityTime';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  updateUser: (updatedUserData: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  const getPushToken = async (): Promise<string> => {
    try {
      if (!Device.isDevice) {
        console.log('Push notifications only work on physical devices');
        return 'simulator-no-token';
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('Push notification permission denied');
        return 'permission-denied';
      }

      const tokenData = await Notifications.getExpoPushTokenAsync({
        projectId: 'your-project-id', // Replace with your Expo project ID from app.json
      });

      return tokenData.data;
    } catch (error) {
      console.error('Error getting push token:', error);
      return 'error-getting-token';
    }
  };

  const updateLastActivity = useCallback(async () => {
    const timestamp = Date.now().toString();
    await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, timestamp);
  }, []);

  const logout = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync('authToken');
      if (token) {
        try {
          await apiClient.patch('/app/auth/logout');
        } catch (error) {
          console.error('Failed to call logout endpoint:', error);
        }
      }

      socketService.disconnect();
      
      setUser(null);
      await SecureStore.deleteItemAsync('user');
      await SecureStore.deleteItemAsync('authToken');
      await SecureStore.deleteItemAsync(LAST_ACTIVITY_KEY);
    } catch (error) {
      console.error("Failed to logout:", error);
      setUser(null);
    }
  }, []);

  const checkSessionTimeout = useCallback(async () => {
    try {
      const lastActivity = await SecureStore.getItemAsync(LAST_ACTIVITY_KEY);
      if (lastActivity) {
        const timeSinceLastActivity = Date.now() - parseInt(lastActivity);
        if (timeSinceLastActivity > SESSION_TIMEOUT) {
          console.log('Session expired after 5 minutes of inactivity');
          await logout();
          return true;
        }
      }
      return false;
    } catch (e) {
      console.error("Failed to check session timeout", e);
      return false;
    }
  }, [logout]);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const storedUser = await SecureStore.getItemAsync('user');
        if (storedUser) {
          const expired = await checkSessionTimeout();
          if (!expired) {
            setUser(JSON.parse(storedUser));
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

  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active' &&
        user
      ) {
        const expired = await checkSessionTimeout();
        if (!expired) {
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
          const response = await apiClient.get('/app/auth/retrieve-jwt-token');
          const data = response.data;

          if (data && data.token) {
            await SecureStore.setItemAsync('appToken', data.token);
            console.log('✅ App token saved successfully');
          }
        }
      } catch (error) {
        console.error("Failed to fetch app token:", error);
      }
    };
    fetchAppToken();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      console.log('🔐 Starting login process...');
      
      // Get push token for notifications
      const pushToken = await getPushToken();
      console.log('📱 Push token obtained');

      // Call login endpoint
      const response = await apiClient.post('/app/auth/login', { 
        email, 
        password,
        pushToken,
      });
      
      console.log('✅ Login API call successful');
      console.log('📦 Response status:', response.status);
      
      if (!response.data || !response.data.user) {
        throw new Error('Invalid response from server');
      }

      const userDataFromBackend = response.data.user;
      
      // CRITICAL FIX: Token is inside user object!
      let authToken = null;
      
      // Check for token in multiple locations
      if (userDataFromBackend.token) {
        // Token is inside the user object (current backend structure)
        authToken = userDataFromBackend.token;
        console.log('✅ Token found in response.data.user.token');
      } else if (response.data.token) {
        // Token is at top level (standard structure)
        authToken = response.data.token;
        console.log('✅ Token found in response.data.token');
      } else if (response.headers['x-access-token']) {
        // Token in headers
        authToken = response.headers['x-access-token'].replace('Bearer ', '');
        console.log('✅ Token found in x-access-token header');
      } else if (response.headers['authorization']) {
        // Token in authorization header
        authToken = response.headers['authorization'].replace('Bearer ', '');
        console.log('✅ Token found in authorization header');
      }
      
      if (!authToken) {
        console.error('❌ NO TOKEN FOUND IN RESPONSE');
        throw new Error('Authentication token not found in response');
      }
      
      console.log('🔑 Auth token obtained:', authToken.substring(0, 30) + '...');
      
      // Create user object (exclude token from user data)
      const userData: User = {
        userId: userDataFromBackend.userId,
        fullname: userDataFromBackend.fullname,
        email: userDataFromBackend.email,
        role: userDataFromBackend.role,
        cellphoneNumber: userDataFromBackend.cellphoneNumber,
        walletID: userDataFromBackend.walletID,
        gender: userDataFromBackend.gender,
        dateOfBirth: userDataFromBackend.dateOfBirth,
        balance: userDataFromBackend.balance,
        profileImage: userDataFromBackend.profileImage,
        address: userDataFromBackend.address,
        region: userDataFromBackend.region,
        town: userDataFromBackend.town,
        nationalId: userDataFromBackend.nationalId,
        isAccountVerified: userDataFromBackend.isAccountVerified,
        isPushNotificationEnabled: userDataFromBackend.isPushNotificationEnabled,
      };

      // Save token FIRST
      await SecureStore.setItemAsync('authToken', authToken);
      console.log('✅ Auth token saved to SecureStore');
      
      // Save user data
      await SecureStore.setItemAsync('user', JSON.stringify(userData));
      console.log('✅ User data saved to SecureStore');
      
      // Verify token works
      try {
        console.log('🧪 Verifying token with /user-details endpoint...');
        const detailsResponse = await apiClient.get('/app/auth/user-details');
        console.log('✅ Token verification successful!');
      } catch (detailsError: any) {
        console.error('⚠️  Token verification failed:', detailsError.response?.data || detailsError.message);
        console.warn('⚠️  Continuing anyway - token might still work for other endpoints');
      }
      
      // Set initial activity timestamp
      await updateLastActivity();
      setUser(userData);
      
      console.log('🎉 Login successful and fully authenticated!');
      return userData;
      
    } catch (error: any) {
      console.error("❌ Login failed:", error.response?.data?.message || error.message);
      setUser(null);
      await SecureStore.deleteItemAsync('user').catch(() => {});
      await SecureStore.deleteItemAsync('authToken').catch(() => {});
      throw error;
    }
  };
  
  const updateUser = async (updatedUserData: Partial<User>) => {
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};