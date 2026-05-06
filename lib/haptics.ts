/**
 * Haptic feedback utility for HealthConnect.
 *
 * Named patterns keep vibration behaviour consistent and easy to change
 * in one place. All functions are async-safe — they swallow errors so a
 * device that doesn't support haptics (simulator, web) never crashes the app.
 */

import * as Haptics from "expo-haptics";

/**
 * Strong triple-vibration alert fired on the **provider** side whenever a new
 * patient request arrives. Designed to be unmistakable even when the phone
 * is in a pocket.
 *
 * Pattern: heavy impact → 100 ms gap → heavy impact → 100 ms gap → heavy impact → 100 ms gap → success notification
 */
export async function hapticNewRequest(): Promise<void> {
  try {
    // First strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Second strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Third strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Final success notification
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // Haptics not supported on this device — fail silently
  }
}

/**
 * Strong triple-vibration success burst fired on the **patient** side when a provider accepts their
 * request, and on teleconsultation when the call is ready.
 *
 * Pattern: success notification → 80 ms gap → heavy impact → 80 ms gap → heavy impact → 80 ms gap → heavy impact
 */
export async function hapticRequestAccepted(): Promise<void> {
  try {
    // Initial success notification
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    await new Promise((resolve) => setTimeout(resolve, 80));

    // First strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Second strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 80));

    // Third strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Haptics not supported on this device — fail silently
  }
}

/**
 * Strong triple-vibration for secondary status transitions on the **patient** side:
 * en_route, arrived, in_progress.
 *
 * Pattern: heavy impact → 70 ms gap → heavy impact → 70 ms gap → heavy impact
 */
export async function hapticStatusChange(): Promise<void> {
  try {
    // First strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 70));

    // Second strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise((resolve) => setTimeout(resolve, 70));

    // Third strong vibration
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  } catch {
    // Haptics not supported on this device — fail silently
  }
}

/**
 * Light confirmation tap when the **provider** successfully accepts or
 * declines a request.
 */
export async function hapticActionConfirm(): Promise<void> {
  try {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  } catch {
    // Haptics not supported on this device — fail silently
  }
}
