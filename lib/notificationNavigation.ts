/**
 * Maps push / in-app notification payloads to the correct app route
 * for the logged-in patient or provider.
 */

import type { Router } from "expo-router";

export type NotificationNavRole = "patient" | "provider";

const PROVIDER_ROLES = new Set([
  "doctor",
  "nurse",
  "physiotherapist",
  "social worker",
  "pharmacist",
]);

/** Pending tap while auth is still loading / user not yet restored. */
let pendingNotificationData: Record<string, unknown> | null = null;

export function toNotificationNavRole(
  role?: string | null,
): NotificationNavRole | null {
  const normalized = String(role || "")
    .trim()
    .toLowerCase();
  if (normalized === "patient") return "patient";
  if (PROVIDER_ROLES.has(normalized)) return "provider";
  return null;
}

function asString(value: unknown): string | undefined {
  if (value == null) return undefined;
  const str = String(value).trim();
  return str.length > 0 ? str : undefined;
}

/**
 * Resolve the expo-router href for a notification payload.
 * Returns null when there is nothing useful to open.
 */
export function resolveNotificationHref(
  data: Record<string, unknown> | null | undefined,
  role: NotificationNavRole,
): string | null {
  if (!data || typeof data !== "object") {
    return role === "patient"
      ? "/(app)/(patient)/home"
      : "/(app)/(provider)/home";
  }

  const type = asString(data.type)?.toLowerCase() || "";
  const requestId = asString(data.requestId);
  const prescriptionId = asString(data.prescriptionId);
  const issueId = asString(data.issueId);

  // Video call ready / in progress
  if (
    type === "consultation_ready_for_call" ||
    type === "consultation_in_call" ||
    type === "ready_for_call" ||
    type === "in_call"
  ) {
    if (requestId) {
      return role === "patient"
        ? `/(app)/(patient)/teleconsultation-call?requestId=${encodeURIComponent(requestId)}`
        : `/(app)/(provider)/teleconsultation-call?requestId=${encodeURIComponent(requestId)}`;
    }
  }

  // Issues
  if (type.startsWith("issue_") || issueId) {
    return role === "patient"
      ? "/(app)/(patient)/issues"
      : "/(app)/(provider)/issues";
  }

  // Provider qualifications
  if (
    type === "qualification_expired" ||
    type === "qualification_expiring_soon"
  ) {
    return "/(app)/(provider)/profile";
  }

  // New incoming request for providers
  if (
    type === "consultation_requested" ||
    type === "new_request_available"
  ) {
    return "/(app)/(provider)/requests";
  }

  // Prescriptions — patient waiting room / provider requests
  if (prescriptionId || type.includes("prescription")) {
    return role === "patient"
      ? "/(app)/(patient)/waiting-room"
      : "/(app)/(provider)/requests";
  }

  // Payment / consultation lifecycle
  if (
    type.startsWith("consultation_") ||
    type === "request_expired" ||
    type === "payment_required" ||
    type === "payment_completed" ||
    type === "payment_failed" ||
    type === "provider_assigned" ||
    requestId
  ) {
    return role === "patient"
      ? "/(app)/(patient)/waiting-room"
      : "/(app)/(provider)/requests";
  }

  // Generic alerts / welcome → notification inbox
  if (
    type === "alert" ||
    type === "welcome" ||
    type === "reminder" ||
    type === "promotion" ||
    type === "app_update" ||
    type === "maintenance_scheduled" ||
    type === "emergency_alert"
  ) {
    return "/notifications";
  }

  // Fallback home for the signed-in role
  return role === "patient"
    ? "/(app)/(patient)/home"
    : "/(app)/(provider)/home";
}

type NavigateArgs = {
  data: Record<string, unknown> | null | undefined;
  isAuthenticated: boolean;
  userRole?: string | null;
  router: Router;
};

/**
 * Navigate now if logged in; otherwise queue until auth is ready.
 */
export function handleNotificationOpen({
  data,
  isAuthenticated,
  userRole,
  router,
}: NavigateArgs): void {
  const role = toNotificationNavRole(userRole);

  if (!isAuthenticated || !role) {
    pendingNotificationData =
      data && typeof data === "object" ? { ...data } : {};
    console.log(
      "⏳ Notification tap queued until login:",
      pendingNotificationData,
    );
    return;
  }

  const href = resolveNotificationHref(data, role);
  if (!href) return;

  console.log("👆 Opening notification →", href, data);
  try {
    router.push(href as any);
  } catch (error) {
    console.warn("⚠️ Notification navigation failed:", error);
  }
}

/**
 * Flush a notification that was tapped before the session finished loading.
 */
export function flushPendingNotificationNavigation({
  isAuthenticated,
  userRole,
  router,
}: Omit<NavigateArgs, "data">): void {
  if (!pendingNotificationData) return;
  if (!isAuthenticated || !toNotificationNavRole(userRole)) return;

  const data = pendingNotificationData;
  pendingNotificationData = null;
  handleNotificationOpen({ data, isAuthenticated, userRole, router });
}
