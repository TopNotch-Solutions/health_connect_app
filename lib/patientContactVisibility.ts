/**
 * Patient cellphone is only shown to providers after accept,
 * until the consultation is completed. Hidden while searching/pending,
 * and after completed (also rejected/cancelled/expired).
 */
const PATIENT_PHONE_VISIBLE_STATUSES = new Set([
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

export function canShowPatientPhone(status?: string | null): boolean {
  if (!status) return false;
  return PATIENT_PHONE_VISIBLE_STATUSES.has(status);
}
