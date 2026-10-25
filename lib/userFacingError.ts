import { isNetworkError } from "./networkDetector";

/** Friendly copy for socket / HTTP timeouts (never show raw "timeout of Xs exceeded"). */
export const SERVER_SLOW_MESSAGE =
  "The request is taking longer than usual. Please check your connection and try again.";

export const OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again.";

export const GENERIC_ERROR_MESSAGE =
  "Something went wrong. Please try again in a moment.";

export const SESSION_EXPIRED_MESSAGE =
  "Your session has expired. Please sign in again.";

export const SESSION_REQUIRED_MESSAGE =
  "Please sign in again to continue.";

function isRawTimeoutMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("timeout") ||
    lower.includes("timed out") ||
    lower.includes("econnaborted") ||
    /timeout of \d+ms/i.test(message)
  );
}

function isAuthDeniedMessage(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("no authorization header") ||
    lower.includes("no token provided") ||
    lower.includes("access denied") ||
    lower.includes("invalid token") ||
    lower.includes("session expired") ||
    lower.includes("authentication required") ||
    lower.includes("authentication failed") ||
    lower.includes("please wait a moment")
  );
}

function softenMessage(message: string): string {
  const trimmed = message.trim();
  if (!trimmed) return GENERIC_ERROR_MESSAGE;
  if (isRawTimeoutMessage(trimmed)) return SERVER_SLOW_MESSAGE;
  if (/please wait a moment/i.test(trimmed)) {
    return "Could not start verification yet. Please try again in a moment.";
  }
  if (isAuthDeniedMessage(trimmed)) {
    if (/expired/i.test(trimmed)) return SESSION_EXPIRED_MESSAGE;
    return SESSION_REQUIRED_MESSAGE;
  }
  return trimmed;
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
    return softenMessage(error) || fallback;
  }

  if (typeof error !== "object") return fallback;

  const err = error as {
    isTimeout?: boolean;
    isOffline?: boolean;
    message?: string;
    error?: string;
    response?: {
      status?: number;
      data?: { message?: string; error?: string };
    };
    code?: string;
  };

  if (err.isOffline) return OFFLINE_MESSAGE;
  if (err.isTimeout) return SERVER_SLOW_MESSAGE;

  if (err.response?.status === 401 || err.response?.status === 403) {
    const authMsg =
      err.response?.data?.message ||
      err.response?.data?.error ||
      err.message;
    if (authMsg && typeof authMsg === "string") {
      return softenMessage(authMsg);
    }
    return SESSION_REQUIRED_MESSAGE;
  }

  const serverMessage =
    err.response?.data?.message ||
    err.response?.data?.error ||
    (typeof err.error === "string" ? err.error : undefined);

  if (serverMessage && typeof serverMessage === "string") {
    return softenMessage(serverMessage) || fallback;
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
    return softenMessage(err.message) || fallback;
  }

  return fallback;
}
