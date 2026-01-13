import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect, useRef, useState } from 'react';
import { Alert, Linking, Platform } from 'react-native';
import { useAuth } from '../context/AuthContext';
import apiClient from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [devicePushToken, setDevicePushToken] = useState<string | undefined>(undefined);
  const [notification, setNotification] = useState<Notifications.Notification | undefined>(undefined);
  const notificationListener = useRef<Notifications.Subscription>(null);
  const responseListener = useRef<Notifications.Subscription>(null);

  async function registerForPushNotificationsAsync() {
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

      // Configure Android notification channel for FCM
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
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
  }

  useEffect(() => {
    if (user?.userId) {
        registerForPushNotificationsAsync().then(token => {
            setDevicePushToken(token || undefined);
            if (token) {
                // Send to backend
                const sendTokenToBackend = async (retryCount = 0) => {
                    try {
                        const response = await apiClient.patch(`/app/auth/update-push-token`, { pushToken: token });
                        console.log("✅ Push token updated on backend:", response.data?.message);
                    } catch (err: any) {
                        console.error("❌ Error updating push token on backend:", err.response?.data?.message || err.message);
                        // Retry up to 3 times if network error
                        if (retryCount < 3 && (err.code === 'ECONNABORTED' || !err.response)) {
                            console.log(`🔄 Retrying token upload (attempt ${retryCount + 1}/3) in 5 seconds...`);
                            setTimeout(() => sendTokenToBackend(retryCount + 1), 5000);
                        }
                    }
                };
                sendTokenToBackend();
            }
        });
    }

    notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
      setNotification(notification);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
      console.log(response);
    });

    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.userId]);

  return {
    devicePushToken,
    notification,
  };
};
