/**
 * Ring + vibrate + spoken voice when a consultation / request status changes.
 * Used on both patient and provider so neither side misses an update
 * while the app is open in the foreground.
 */

import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import * as Speech from "expo-speech";
import { Platform, Vibration } from "react-native";
import {
  hapticNewRequest,
  hapticRequestAccepted,
  hapticStatusChange,
} from "./haptics";

// Metro asset module id (see app.d.ts for *.wav)
const ALERT_SOUND = require("../assets/sounds/healthconnect_alert.wav") as number;

type AlertPlayer = ReturnType<typeof createAudioPlayer>;

export type ConsultationAlertRole = "patient" | "provider";

/** Statuses that should ring + vibrate + speak when they change. */
const ALERT_STATUSES = new Set([
  "accepted",
  "payment_pending",
  "paid",
  "provider_confirmation_pending",
  "ready_for_call",
  "en_route",
  "arrived",
  "in_progress",
  "in_call",
  "completed",
  "cancelled",
]);

const STRONG_STATUSES = new Set([
  "accepted",
  "ready_for_call",
  "provider_confirmation_pending",
  "paid",
]);

const PATIENT_VOICE: Record<string, string> = {
  accepted: "Your consultation request has been accepted by a provider.",
  payment_pending: "Payment is pending for your consultation.",
  paid: "Payment received. Waiting for your provider to confirm.",
  provider_confirmation_pending:
    "Your provider is confirming payment for the consultation.",
  ready_for_call: "Your video consultation is ready to join.",
  en_route: "Your healthcare provider is on the way to you.",
  arrived: "Your healthcare provider has arrived.",
  in_progress: "Your consultation is now in progress.",
  in_call: "You are now in a consultation call.",
  completed: "Your consultation has been completed.",
  cancelled: "Your consultation has been cancelled.",
};

const PROVIDER_VOICE: Record<string, string> = {
  accepted: "You have accepted a consultation request.",
  payment_pending: "Patient payment is pending for this consultation.",
  paid: "Patient payment received. Please confirm to continue.",
  provider_confirmation_pending:
    "Please confirm that you have received the patient payment.",
  ready_for_call: "Video consultation is ready. You can join the call.",
  en_route: "Status updated. You are marked as en route to the patient.",
  arrived: "Status updated. You are marked as arrived at the patient.",
  in_progress: "Consultation is now in progress.",
  in_call: "You are now in a consultation call with the patient.",
  completed: "Consultation has been completed.",
  cancelled: "A consultation has been cancelled.",
};

const NEW_REQUEST_VOICE =
  "New healthcare request available. Please check your incoming requests.";

let alertPlayer: AlertPlayer | null = null;
let audioReady = false;
let lastAlertKey = "";
let lastAlertAt = 0;

async function ensureAudioMode(): Promise<void> {
  if (audioReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "doNotMix",
      shouldPlayInBackground: false,
    });
    audioReady = true;
  } catch {
    // Audio mode may fail on web / simulators — still try to play.
  }
}

async function playAlertRing(): Promise<void> {
  try {
    await ensureAudioMode();

    if (alertPlayer) {
      try {
        alertPlayer.pause();
        alertPlayer.remove();
      } catch {
        // ignore cleanup errors
      }
      alertPlayer = null;
    }

    const player = createAudioPlayer(ALERT_SOUND);
    alertPlayer = player;
    player.volume = 1;
    player.play();

    // Release after the chime finishes so we don't leak players
    setTimeout(() => {
      if (alertPlayer !== player) return;
      try {
        player.pause();
        player.remove();
      } catch {
        // ignore
      }
      alertPlayer = null;
    }, 4000);
  } catch (error) {
    console.warn("⚠️ Consultation alert sound failed:", error);
  }
}

function vibrateForStatus(status: string): void {
  // Native vibration pattern — noticeable even in a pocket
  if (Platform.OS === "android") {
    if (STRONG_STATUSES.has(status)) {
      Vibration.vibrate([0, 400, 120, 400, 120, 400]);
    } else {
      Vibration.vibrate([0, 280, 100, 280, 100, 280]);
    }
  } else {
    // iOS only supports a single short vibration via this API
    Vibration.vibrate();
  }
}

async function hapticForStatus(status: string): Promise<void> {
  if (STRONG_STATUSES.has(status)) {
    await hapticRequestAccepted();
  } else {
    await hapticStatusChange();
  }
}

function speakAlert(message: string): void {
  try {
    Speech.stop();
    // Brief delay so the ringtone starts first, then the spoken message
    setTimeout(() => {
      Speech.speak(message, {
        language: "en-GB",
        pitch: 1.0,
        rate: Platform.OS === "ios" ? 0.95 : 0.9,
      });
    }, 450);
  } catch (error) {
    console.warn("⚠️ Consultation voice alert failed:", error);
  }
}

function voiceForStatus(
  status: string,
  role: ConsultationAlertRole,
): string {
  const map = role === "provider" ? PROVIDER_VOICE : PATIENT_VOICE;
  return (
    map[status] ||
    `Consultation status updated to ${String(status).replace(/_/g, " ")}.`
  );
}

function shouldAlert(status: string, requestId?: string): boolean {
  if (!status || !ALERT_STATUSES.has(status)) return false;

  const key = `${requestId || "unknown"}:${status}`;
  const now = Date.now();
  // Deduplicate socket double-fires (requestUpdated + requestStatusChanged)
  if (key === lastAlertKey && now - lastAlertAt < 2500) {
    return false;
  }
  lastAlertKey = key;
  lastAlertAt = now;
  return true;
}

/**
 * Ring + vibrate + speak for a consultation status transition.
 * Safe to call from multiple listeners — duplicates are ignored briefly.
 * Pass role so patient and provider hear the correct spoken message.
 */
export async function alertConsultationStatusChange(
  status: string,
  requestId?: string,
  role: ConsultationAlertRole = "patient",
): Promise<void> {
  if (!shouldAlert(status, requestId)) return;

  vibrateForStatus(status);
  speakAlert(voiceForStatus(status, role));
  await Promise.all([playAlertRing(), hapticForStatus(status)]);
}

/**
 * Ring + vibrate + speak when a brand-new request appears for a provider.
 */
export async function alertNewRequestAvailable(): Promise<void> {
  const key = `new-request:${Date.now()}`;
  // Soft dedupe only for simultaneous double listeners within 1.5s
  if (lastAlertKey.startsWith("new-request:") && Date.now() - lastAlertAt < 1500) {
    return;
  }
  lastAlertKey = key;
  lastAlertAt = Date.now();

  if (Platform.OS === "android") {
    Vibration.vibrate([0, 400, 120, 400, 120, 400, 120, 400]);
  } else {
    Vibration.vibrate();
  }
  speakAlert(NEW_REQUEST_VOICE);
  await Promise.all([playAlertRing(), hapticNewRequest()]);
}
