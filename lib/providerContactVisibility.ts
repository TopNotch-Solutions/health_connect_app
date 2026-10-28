/**
 * Provider cellphone is shown to the patient after accept through the
 * active consultation lifecycle (payment, en route, in progress / call).
 * Hidden once completed, and also while still searching / after cancel.
 */
const PROVIDER_PHONE_VISIBLE_STATUSES = new Set([
  "accepted",
  "payment_pending",
  "paid",
  "provider_confirmation_pending",
  "ready_for_call",
  "in_call",
  "en_route",
  "arrived",
  "in_progress",
]);

export function canShowProviderPhone(status?: string | null): boolean {
  if (!status) return false;
  return PROVIDER_PHONE_VISIBLE_STATUSES.has(status);
}
