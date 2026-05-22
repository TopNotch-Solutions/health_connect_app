import { useGlobalScreenCaptureProtection } from "../lib/screenCapture";

/** Mount once at the app root to block screenshots and screen recording. */
export function ScreenCaptureProtection() {
  useGlobalScreenCaptureProtection();
  return null;
}
