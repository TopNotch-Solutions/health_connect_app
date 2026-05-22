import * as ScreenCapture from "expo-screen-capture";
import { useEffect } from "react";
import { Platform } from "react-native";

export const SCREEN_CAPTURE_PROTECTION_KEY = "health-connect-global";

/**
 * Blocks screenshots and screen recording for the whole app (iOS 13+, Android).
 * Android also uses FLAG_SECURE via plugins/withPreventScreenshots.js on prebuild.
 */
export function useGlobalScreenCaptureProtection(): void {
  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const available = await ScreenCapture.isAvailableAsync();
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
