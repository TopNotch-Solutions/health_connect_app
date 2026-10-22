import * as ScreenCapture from "expo-screen-capture";
import { usePathname } from "expo-router";
import { useEffect } from "react";
import { Platform } from "react-native";

export const SCREEN_CAPTURE_PROTECTION_KEY = "health-connect-page";

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

async function enableProtection(): Promise<void> {
  const available = await isScreenCaptureAvailable();
  if (!available) {
    return;
  }

  await ScreenCapture.preventScreenCaptureAsync(SCREEN_CAPTURE_PROTECTION_KEY);
  if (Platform.OS === "ios") {
    await ScreenCapture.enableAppSwitcherProtectionAsync(0.75);
  }
}

async function disableProtection(): Promise<void> {
  const available = await isScreenCaptureAvailable();
  if (!available) {
    return;
  }

  await ScreenCapture.allowScreenCaptureAsync(SCREEN_CAPTURE_PROTECTION_KEY);
  if (Platform.OS === "ios") {
    await ScreenCapture.disableAppSwitcherProtectionAsync();
  }
}

/** True on the Stream video call screen — no screenshot protection there. */
export function isTeleconsultationCallRoute(pathname: string | null): boolean {
  if (!pathname) {
    return false;
  }
  return pathname.includes("teleconsultation-call");
}

/**
 * Blocks screenshots / screen recording on every page except the
 * teleconsultation video call screen (WebRTC must not run under preventScreenCapture).
 */
export function useScreenCaptureProtectionOnAllPagesExceptCall(): void {
  const pathname = usePathname();
  const onVideoCall = isTeleconsultationCallRoute(pathname);

  useEffect(() => {
    if (Platform.OS === "web") {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        if (cancelled) {
          return;
        }
        if (onVideoCall) {
          await disableProtection();
        } else {
          await enableProtection();
        }
      } catch (error) {
        console.warn("Screen capture protection update failed:", error);
      }
    })();

    return () => {
      cancelled = true;
      // Clear on route change / unmount so the next screen can set the right state
      // (especially when entering teleconsultation-call).
      void disableProtection();
    };
  }, [onVideoCall]);
}
