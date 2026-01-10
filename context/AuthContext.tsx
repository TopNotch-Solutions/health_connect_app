import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Alert, AppState, AppStateStatus, Linking, Platform } from 'react-native';
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

  const getPushToken = async (): Promise<string | null> => {
    try {
      if (!Device.isDevice) {
        Alert.alert(
          'Push Notifications Required',
          'Push notifications are only available on physical devices. Please use a physical device to receive notifications.',
          [{ text: 'OK' }]
        );
        console.log('⚠️  Not a physical device - skipping push notifications');
        return null;
      }

      // Request notification permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        console.log('🔔 Requesting push notification permissions...');
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
        console.log('🔔 Permission result:', status);
      }

      if (finalStatus !== 'granted') {
        Alert.alert(
          'Enable Push Notifications',
          'Push notifications are required to receive important updates. Please enable notifications in your device settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              },
            },
          ]
        );
        console.log('⚠️  Push notification permission denied by user');
        return null;
      }

      // Configure Android notification channel for FCM
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      // Get the native device push token (FCM token on Android, APNS token on iOS)
      console.log('🔄 Requesting native device push token...');
      const deviceToken = await Promise.race([
        Notifications.getDevicePushTokenAsync(),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Push token request timeout')), 10000)
        )
      ]);
      
      // On Android, this returns the FCM token directly
      // On iOS, this returns the APNS token
      const fcmToken = deviceToken.data;
      
      if (!fcmToken || fcmToken.trim() === '') {
        throw new Error('Empty token received from device');
      }
      
      console.log('✅ Native Device Push Token obtained successfully');
      console.log('📱 Platform:', Platform.OS);
      console.log('📝 Token preview:', fcmToken.substring(0, 50) + '...');
      console.log('📏 Token length:', fcmToken.length);
      return fcmToken;
      
    } catch (error: any) {
      console.error('❌ Error getting push token:', error.message);
      console.error('Error code:', error.code);
      
      // Show alert to user
      Alert.alert(
        'Enable Push Notifications',
        'Unable to get push notification token. Please ensure push notifications are enabled in your device settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
      
      // Provide helpful error messages
      if (error.message?.includes('timeout')) {
        console.warn('⚠️  Network timeout - check your internet connection');
      } else if (error.code === 'ERR_NOTIFICATIONS_UNSUPPORTED') {
        console.warn('⚠️  Push notifications not supported on this device/emulator');
      } else if (error.message?.includes('Empty token')) {
        console.warn('⚠️  Device returned empty token - check notification configuration');
      }
      
      return null;
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
          console.log('🔑 Fetching app token...');
          const response = await apiClient.get('/app/auth/retrieve-jwt-token');
          const data = response.data;

          if (data && data.token) {
            await SecureStore.setItemAsync('appToken', data.token);
            console.log('✅ App token saved successfully');
          } else {
            console.error('❌ No app token in response');
          }
        } else {
          console.log('✅ App token already exists');
        }
      } catch (error) {
        console.error("❌ Failed to fetch app token:", error);
      }
    };
    fetchAppToken();
  }, []);

  const login = async (email: string, password: string): Promise<User> => {
    try {
      console.log('🔐 Starting login process...');
      
      // Ensure app token exists before login
      let appToken = await SecureStore.getItemAsync('appToken');
      if (!appToken) {
        console.log('⚠️  No app token found, fetching...');
        try {
          const response = await apiClient.get('/app/auth/retrieve-jwt-token');
          if (response.data && response.data.token) {
            appToken = response.data.token;
            if (appToken) {
              await SecureStore.setItemAsync('appToken', appToken);
              console.log('✅ App token fetched and saved');
            }
          } else {
            throw new Error('Failed to get app token from server');
          }
        } catch (tokenError) {
          console.error('❌ Failed to fetch app token:', tokenError);
          throw new Error('Cannot connect to server. Please check your internet connection.');
        }
      }
      
      // Get push token from device - this is required for push notifications
      console.log('🔔 Attempting to get device push token...');
      let pushToken = await getPushToken();
      
      // If we didn't get a token, try one more time after a short delay
      if (!pushToken) {
        console.log('⚠️  First attempt failed, retrying push token retrieval...');
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        pushToken = await getPushToken();
      }
      
      if (pushToken) {
        console.log('✅ Push token obtained successfully');
        console.log('📝 Token length:', pushToken.length);
        console.log('📝 Token preview:', pushToken.substring(0, 30) + '...');
      } else {
        console.error('❌ Failed to obtain push token after retry');
        console.warn('⚠️  Login will proceed without push token - user will not receive push notifications');
      }

      // Call login endpoint with email, password, and pushToken (null if not available)
      console.log('🌐 Calling login API...');
      const response = await apiClient.post('/app/auth/login', { 
        email, 
        password,
        pushToken: pushToken || null, // Pass null if token not available, let backend handle it
      });
      
      console.log('✅ Login API call successful');
      console.log('📦 Response status:', response.status);
      
      if (!response.data || !response.data.user) {
        throw new Error('Invalid response from server');
      }

      const userDataFromBackend = response.data.user;
      
      // Get JWT token from response
      let authToken = null;
      
      // Check for token in response
      if (response.data.token) {
        authToken = response.data.token;
        console.log('✅ Token found in response.data.token');
      } else if (userDataFromBackend.token) {
        authToken = userDataFromBackend.token;
        console.log('✅ Token found in response.data.user.token');
      }
      
      // If no token in response, the backend's login function is missing the token return
      if (!authToken) {
        console.error('❌ Backend login response missing token');
        console.log('⚠️  Backend needs to return token in login response');
        throw new Error('Server error: Authentication token not provided');
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
      
      // Set initial activity timestamp
      await updateLastActivity();
      setUser(userData);
      
      // If we didn't get a push token during login, try again in the background
      if (!pushToken) {
        console.log('🔄 Retrying push token setup in background...');
        setTimeout(async () => {
          try {
            const retryToken = await getPushToken();
            if (retryToken) {
              console.log('✅ Push token obtained on retry, updating...');
              await apiClient.patch('/app/auth/update-push-token', {
                pushToken: retryToken,
              });
              console.log('✅ Push token updated successfully');
            }
          } catch (retryError) {
            console.log('⚠️  Background push token update failed:', retryError);
          }
        }, 3000); // Wait 3 seconds after login
      }
      
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