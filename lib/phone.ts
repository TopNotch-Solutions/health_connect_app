/**
 * Namibian mobile helpers.
 * Accepted prefixes: 81 and 85 (MTC / Telecom).
 */

/** Strip non-digits (and leading +). */
export function digitsOnly(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

/**
 * Normalize to backend format: 12 digits starting with 26481 or 26485.
 * Accepts: 081… / 085… / 81… / 85… / 26481… / 26485…
 */
export function normalizeNamibianPhone(input: string): string {
  let s = digitsOnly(input);
  if (s.startsWith("264")) return s;
  if (s.startsWith("0")) s = s.slice(1);
  return `264${s}`;
}

/**
 * Returns an error message if invalid, otherwise null.
 * Accepts local (081/085…) or international (26481/26485…) forms.
 */
export function validateNamibianPhone(raw: string): string | null {
  const cleaned = digitsOnly(raw);
  if (!cleaned) return "Cellphone number is required";

  const local =
    cleaned.startsWith("264") && cleaned.length === 12
      ? "0" + cleaned.slice(3)
      : cleaned.startsWith("8") && cleaned.length === 9
        ? "0" + cleaned
        : cleaned;

  if (!/^08[15]\d{7}$/.test(local)) {
    return "Enter a valid Namibian mobile number (e.g. 0811234567 or 0851234567)";
  }
  return null;
}

/** True when the value is a valid 81/85 Namibian mobile. */
export function isValidNamibianPhone(raw: string): boolean {
  return validateNamibianPhone(raw) === null;
}
