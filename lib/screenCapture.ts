import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";
import { Platform } from "react-native";

export const SCREEN_CAPTURE_PROTECTION_KEY = "health-connect-global";

async function isScreenCaptureAvailable(): Promise<boolean> {
  if (Platform.OS === "web") {
    return false;
  }
  try {
    return await ScreenCapture.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Blocks screenshots and screen recording for the whole app (iOS 13+, Android).
 * Prefer this over a permanent Activity FLAG_SECURE so video calls can lift
 * protection without fighting native window flags.
 */
export function useGlobalScreenCaptureProtection(): void {
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const available = await isScreenCaptureAvailable();
        if (!available || cancelled) {
          return;
        }

        await ScreenCapture.preventScreenCaptureAsync(
          SCREEN_CAPTURE_PROTECTION_KEY,
        );

        if (Platform.OS === "ios") {
          await ScreenCapture.enableAppSwitcherProtectionAsync(0.75);
        }
      } catch (error) {
        console.warn("Screen capture protection unavailable:", error);
      }
    })();

    return () => {
      cancelled = true;
      void ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_PROTECTION_KEY);
      if (Platform.OS === "ios") {
        void ScreenCapture.disableAppSwitcherProtectionAsync();
      }
    };
  }, []);
}

/** Lift screenshot / app-switcher protection so WebRTC video can render. */
export async function pauseScreenCaptureForCall(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  try {
    const available = await isScreenCaptureAvailable();
    if (!available) {
      return;
    }

    await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_PROTECTION_KEY);
    if (Platform.OS === "ios") {
      await ScreenCapture.disableAppSwitcherProtectionAsync();
    }
  } catch (error) {
    console.warn("Unable to pause screen capture for video call:", error);
  }
}

/** Re-apply screenshot / app-switcher protection after a call ends. */
export async function resumeScreenCaptureAfterCall(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }

  try {
    const available = await isScreenCaptureAvailable();
    if (!available) {
      return;
    }

    await ScreenCapture.preventScreenCaptureAsync(
      SCREEN_CAPTURE_PROTECTION_KEY,
    );
    if (Platform.OS === "ios") {
      await ScreenCapture.enableAppSwitcherProtectionAsync(0.75);
    }
  } catch (error) {
    console.warn(
      "Unable to restore screen capture protection after call:",
      error,
    );
  }
}

/**
 * Temporarily lifts global screenshot / app-switcher protection.
 * Required during WebRTC video calls — preventScreenCapture blanks
 * RTCView streams (black / blocked video) while protection is active.
 */
export function useAllowScreenCaptureDuringCall(): void {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (cancelled) {
        return;
      }
      await pauseScreenCaptureForCall();
    })();

    return () => {
      cancelled = true;
      void resumeScreenCaptureAfterCall();
    };
  }, []);
}
