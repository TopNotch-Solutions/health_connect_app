/**
 * Push notification utility for HealthConnect.
 *
 * Handles:
 *  - Requesting OS permission (iOS requires explicit ask; Android 13+ too)
 *  - Creating the Android notification channel
 *  - Obtaining the Expo push token
 *  - Registering / clearing the token with the backend
 *  - Setting up foreground notification behaviour
 *
 * The backend endpoint expected:
 *   POST /app/notification/register-push-token   { token, platform }
 *   DELETE /app/notification/register-push-token { token }
 */

import * as Device from "expo-device";
import { Platform } from "react-native";
import apiClient from "./api";

type NotificationsModule = typeof import("expo-notifications");

// ─── Project ID from app.json / eas.json ────────────────────────────────────
const EXPO_PROJECT_ID = "dbc55ad6-fc57-47ee-89c3-2a849f7553fa";

// ─── Android channel ────────────────────────────────────────────────────────
export const NOTIFICATION_CHANNEL_ID = "healthconnect-default";

let notificationsModulePromise: Promise<NotificationsModule | null> | null =
  null;

export async function getNotificationsModule(): Promise<NotificationsModule | null> {
  if (notificationsModulePromise) {
    return notificationsModulePromise;
  }

  notificationsModulePromise = import("expo-notifications")
    .then((module) => module)
    .catch((error) => {
      console.warn(
        "⚠️ expo-notifications native module not available in this build:",
        error,
      );
      return null;
    });

  return notificationsModulePromise;
}

export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  await Notifications.setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: "HealthConnect Notifications",
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 150, 250], // custom buzz pattern
    lightColor: "#10B981",
    // Custom two-tone chime — file at android/app/src/main/res/raw/healthconnect_alert.wav
    sound: "healthconnect_alert.wav",
    enableVibrate: true,
    showBadge: true,
  });
}

// ─── Foreground display behaviour ───────────────────────────────────────────
// Show banner + play sound even when the app is open in the foreground.
export async function configureForegroundHandler(): Promise<void> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) return;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function addNotificationListeners(handlers: {
  onReceive?: (notification: import("expo-notifications").Notification) => void;
  onResponse?: (
    response: import("expo-notifications").NotificationResponse,
  ) => void;
}): Promise<{
  notificationSubscription?: import("expo-notifications").EventSubscription;
  responseSubscription?: import("expo-notifications").EventSubscription;
}> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return {};
  }

  return {
    notificationSubscription: handlers.onReceive
      ? Notifications.addNotificationReceivedListener(handlers.onReceive)
      : undefined,
    responseSubscription: handlers.onResponse
      ? Notifications.addNotificationResponseReceivedListener(
          handlers.onResponse,
        )
      : undefined,
  };
}

// ─── Permission + token ──────────────────────────────────────────────────────
/**
 * Requests notification permission from the OS and returns the Expo push
 * token string, or null if permission was denied or the device is a simulator.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  const Notifications = await getNotificationsModule();
  if (!Notifications) {
    return null;
  }

  // Expo push tokens only work on physical devices
  if (!Device.isDevice) {
    console.warn("⚠️ Push notifications require a physical device");
    return null;
  }

  // Set up Android channel before requesting permission
  await setupAndroidChannel();

  // Check / request permission
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("⚠️ Push notification permission not granted");
    return null;
  }

  // Get the Expo push token (works with EAS builds and the Expo push service)
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: EXPO_PROJECT_ID,
    });
    console.log("✅ Expo push token obtained:", tokenData.data);
    return tokenData.data;
  } catch (error) {
    console.error("❌ Failed to get push token:", error);
    return null;
  }
}

// ─── Backend registration ────────────────────────────────────────────────────
/**
 * Sends the device push token to the backend so the server can deliver
 * push notifications to this device.
 *
 * Backend endpoint: PATCH /app/auth/update-push-token
 *   body: { pushToken: string }
 */
export async function savePushTokenToBackend(token: string): Promise<void> {
  try {
    await apiClient.patch("/app/auth/update-push-token", {
      pushToken: token,
    });
    console.log("✅ Push token registered with backend");
  } catch (error) {
    // Non-fatal — the app still works, push just won't arrive until next login
    console.warn("⚠️ Could not register push token with backend:", error);
  }
}

/**
 * The backend clears expoPushToken automatically when the user logs out
 * via PATCH /app/auth/logout — no separate call needed.
 * This function is kept as a no-op so call sites don't need to change.
 */
export async function removePushTokenFromBackend(_token: string): Promise<void> {
  // Token is cleared server-side by the logout endpoint (expoPushToken = null)
  console.log("ℹ️ Push token will be cleared by backend logout handler");
}
