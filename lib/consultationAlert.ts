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
import { isProviderOnline } from "./providerOnline";

const ALERT_SOUND = require("../assets/sounds/healthconnect_alert.wav") as number;

type AlertPlayer = ReturnType<typeof createAudioPlayer>;

export type ConsultationAlertRole = "patient" | "provider";

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

const CONSULTATION_SUBMITTED_VOICE =
  "Your consultation request has been submitted. Please wait while we find a healthcare provider for you.";

let alertPlayer: AlertPlayer | null = null;
let alertPlayerReady: Promise<AlertPlayer> | null = null;
let audioReady = false;
let lastAlertKey = "";
let lastAlertAt = 0;
/** Request IDs we already announced (socket + poll dedupe). */
const announcedNewRequestIds = new Set<string>();

async function ensureAudioMode(): Promise<void> {
  if (audioReady) return;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      shouldPlayInBackground: false,
      allowsRecording: false,
    });
    audioReady = true;
  } catch {
    // ignore
  }
}

async function getAlertPlayer(): Promise<AlertPlayer> {
  await ensureAudioMode();
  if (alertPlayer) return alertPlayer;

  if (!alertPlayerReady) {
    alertPlayerReady = (async () => {
      const player = createAudioPlayer(ALERT_SOUND, { downloadFirst: true });
      // Give asset a moment without polling isLoaded (that crashed after release)
      await new Promise((r) => setTimeout(r, 300));
      alertPlayer = player;
      return player;
    })().catch((error) => {
      alertPlayerReady = null;
      alertPlayer = null;
      throw error;
    });
  }

  return alertPlayerReady;
}

export async function preloadConsultationAlertSound(): Promise<void> {
  try {
    await getAlertPlayer();
  } catch (error) {
    console.warn("⚠️ Consultation alert preload failed:", error);
  }
}

async function playAlertRing(): Promise<void> {
  try {
    const player = await getAlertPlayer();
    player.volume = 1;
    try {
      await player.seekTo(0);
    } catch {
      // ignore
    }
    player.play();
  } catch (error) {
    console.warn("⚠️ Consultation alert sound failed:", error);
    alertPlayer = null;
    alertPlayerReady = null;
  }
}

function vibrateForStatus(status: string): void {
  if (Platform.OS === "android") {
    if (STRONG_STATUSES.has(status)) {
      Vibration.vibrate([0, 400, 120, 400, 120, 400]);
    } else {
      Vibration.vibrate([0, 280, 100, 280, 100, 280]);
    }
  } else {
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

/** Speak immediately — do not wait on the chime (expo-audio can block TTS). */
function speakNow(message: string): void {
  try {
    void Speech.stop().catch(() => undefined);
    Speech.speak(message, {
      language: "en-US",
      pitch: 1.0,
      rate: Platform.OS === "ios" ? 0.94 : 0.9,
      volume: 1.0,
      ...(Platform.OS === "ios"
        ? { useApplicationAudioSession: false }
        : null),
      onStart: () => console.log("🗣️ Voice alert started"),
      onDone: () => console.log("🗣️ Voice alert finished"),
      onError: (error) =>
        console.warn("⚠️ Consultation voice alert failed:", error),
    });
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
  if (key === lastAlertKey && now - lastAlertAt < 2500) {
    return false;
  }
  lastAlertKey = key;
  lastAlertAt = now;
  return true;
}

export async function alertConsultationStatusChange(
  status: string,
  requestId?: string,
  role: ConsultationAlertRole = "patient",
): Promise<void> {
  if (!shouldAlert(status, requestId)) return;

  vibrateForStatus(status);
  speakNow(voiceForStatus(status, role));
  void Promise.all([playAlertRing(), hapticForStatus(status)]);
}

export async function alertConsultationSubmitted(
  requestId?: string,
): Promise<void> {
  const key = `submitted:${requestId || Date.now()}`;
  const now = Date.now();
  if (lastAlertKey.startsWith("submitted:") && now - lastAlertAt < 2000) {
    return;
  }
  lastAlertKey = key;
  lastAlertAt = now;

  if (Platform.OS === "android") {
    Vibration.vibrate([0, 280, 100, 280]);
  } else {
    Vibration.vibrate();
  }
  speakNow(CONSULTATION_SUBMITTED_VOICE);
  void Promise.all([playAlertRing(), hapticStatusChange()]);
}

/**
 * Ring + vibrate + speak when a brand-new request appears for a provider.
 * Pass requestId when known so socket + poll don't double-announce.
 */
export async function alertNewRequestAvailable(
  requestId?: string,
): Promise<void> {
  console.log("🔔 alertNewRequestAvailable called", {
    requestId,
    online: isProviderOnline(),
  });

  if (!isProviderOnline()) {
    console.log("🔇 Skipping new-request alert — provider is offline");
    return;
  }

  if (requestId) {
    const id = String(requestId);
    if (announcedNewRequestIds.has(id)) {
      console.log("🔇 Already announced request", id);
      return;
    }
    announcedNewRequestIds.add(id);
    // Bound memory
    if (announcedNewRequestIds.size > 200) {
      const first = announcedNewRequestIds.values().next().value;
      if (first) announcedNewRequestIds.delete(first);
    }
  } else {
    const now = Date.now();
    if (
      lastAlertKey.startsWith("new-request:") &&
      now - lastAlertAt < 2000
    ) {
      return;
    }
    lastAlertKey = `new-request:${now}`;
    lastAlertAt = now;
  }

  console.log("🗣️ Speaking provider new-request voice");

  if (Platform.OS === "android") {
    Vibration.vibrate([0, 400, 120, 400, 120, 400, 120, 400]);
  } else {
    Vibration.vibrate();
  }

  // Voice FIRST so it always plays even if the wav fails
  speakNow(NEW_REQUEST_VOICE);
  void Promise.all([playAlertRing(), hapticNewRequest()]);
}
