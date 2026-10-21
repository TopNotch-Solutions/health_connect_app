import { isNetworkError } from "./networkDetector";

/** Friendly copy for socket / HTTP timeouts (never show raw "timeout of Xs exceeded"). */
export const SERVER_SLOW_MESSAGE =
  "The request is taking longer than usual. Please check your connection and try again.";

export const OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again.";

export const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again in a moment.";

function isRawTimeoutMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnaborted") ||
    /timeout of \d+ms/i.test(message)
  );
}

/**
 * Turns axios / socket / unknown errors into a short message safe to show in Alerts.
 * Prefers backend `message` when present; never surfaces technical timeout text.
 */
export function getUserFacingErrorMessage(
  error: unknown,
  fallback: string = GENERIC_ERROR_MESSAGE,
): string {
  if (!error) return fallback;

  if (typeof error === "string") {
    const trimmed = error.trim();
    if (!trimmed) return fallback;
    if (isRawTimeoutMessage(trimmed)) return SERVER_SLOW_MESSAGE;
    return trimmed;
  }

  if (typeof error !== "object") return fallback;

  const err = error as {
    isTimeout?: boolean;
    isOffline?: boolean;
    message?: string;
    error?: string;
    response?: { data?: { message?: string; error?: string } };
    code?: string;
  };

  if (err.isOffline) return OFFLINE_MESSAGE;
  if (err.isTimeout) return SERVER_SLOW_MESSAGE;

  const serverMessage =
    err.response?.data?.message ||
    err.response?.data?.error ||
    (typeof err.error === "string" ? err.error : undefined);

  if (serverMessage && typeof serverMessage === "string") {
    const trimmed = serverMessage.trim();
    if (trimmed) {
      if (isRawTimeoutMessage(trimmed)) return SERVER_SLOW_MESSAGE;
      return trimmed;
    }
  }

  if (isNetworkError(err) || isRawTimeoutMessage(err.message || "")) {
    if (
      err.code === "ECONNABORTED" ||
      err.isTimeout ||
      isRawTimeoutMessage(err.message || "")
    ) {
      return SERVER_SLOW_MESSAGE;
    }
    return OFFLINE_MESSAGE;
  }

  if (err.message && typeof err.message === "string") {
    const trimmed = err.message.trim();
    if (trimmed && !isRawTimeoutMessage(trimmed)) return trimmed;
    if (isRawTimeoutMessage(trimmed)) return SERVER_SLOW_MESSAGE;
  }

  return fallback;
}
