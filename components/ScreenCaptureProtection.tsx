import { useScreenCaptureProtectionOnAllPagesExceptCall } from "../lib/screenCapture";

/**
 * Applies expo-screen-capture on all routes except teleconsultation-call.
 * Mount once in the root layout — it follows the current pathname.
 */
export function ScreenCaptureProtection() {
  useScreenCaptureProtectionOnAllPagesExceptCall();
  return null;
}
