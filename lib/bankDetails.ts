export type BankDetailsPayload = {
  accountHolder: string;
  bankName: string;
  branchName: string;
  branchCode: string;
  accountNumber: string;
  accountType: string;
};

export type BankDetailsRecord = BankDetailsPayload & {
  id?: string;
  userId?: string;
  isComplete?: boolean;
  updatedAt?: string;
  createdAt?: string;
};

export type BankDetailsField = keyof BankDetailsPayload;

/**
 * Display-only mask: first 2 + last 2 characters, middle as *
 * (one asterisk per missing character). Claim PDFs still use full
 * values from the server DB.
 */
export function maskBankField(value: string | null | undefined): string {
  const text = String(value || "");
  if (!text) return "";
  if (text.length <= 4) {
    return "*".repeat(text.length);
  }
  const first = text.slice(0, 2);
  const last = text.slice(-2);
  const middle = "*".repeat(text.length - 4);
  return `${first}${middle}${last}`;
}

/** @deprecated prefer maskBankField */
export function maskAccountNumber(value: string | null | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  return maskBankField(digits || value);
}

export function isMaskedBankField(value: string | null | undefined): boolean {
  return /\*/.test(String(value || ""));
}

export function isMaskedAccountNumber(
  value: string | null | undefined,
): boolean {
  return isMaskedBankField(value);
}

export const emptyBankDetails = (
  defaults?: Partial<BankDetailsPayload>,
): BankDetailsPayload => ({
  accountHolder: defaults?.accountHolder || "",
  bankName: defaults?.bankName || "",
  branchName: defaults?.branchName || "",
  branchCode: defaults?.branchCode || "",
  accountNumber: defaults?.accountNumber || "",
  accountType: defaults?.accountType || "",
});

export function validateBankDetails(form: BankDetailsPayload): string | null {
  if (!String(form.accountHolder || "").trim()) {
    return "Account holder / practice name is required.";
  }
  if (!String(form.bankName || "").trim()) {
    return "Bank name is required.";
  }
  if (!String(form.branchName || "").trim()) {
    return "Branch name is required.";
  }
  const branchCode = String(form.branchCode || "").trim();
  if (!branchCode) return "Branch code is required.";
  if (isMaskedBankField(branchCode)) {
    // Masked value from API — allowed on save (server keeps the real value).
  } else if (!/^[0-9A-Za-z-]{3,20}$/.test(branchCode)) {
    return "Branch code looks invalid. Use the bank branch code only.";
  }
  const accountNumber = String(form.accountNumber || "").trim();
  if (!accountNumber) return "Account number is required.";
  if (isMaskedBankField(accountNumber)) {
    if (accountNumber.length < 4) {
      return "Enter the full account number (6–20 digits), or leave the masked number unchanged.";
    }
  } else if (!/^\d{6,20}$/.test(accountNumber)) {
    return "Account number must be 6–20 digits.";
  }
  if (!String(form.accountType || "").trim()) {
    return "Account type is required.";
  }
  // Masked non-account fields are fine — server restores full values.
  for (const key of [
    "accountHolder",
    "bankName",
    "branchName",
    "accountType",
  ] as const) {
    if (
      isMaskedBankField(form[key]) &&
      String(form[key] || "").trim().length < 4
    ) {
      return `Enter the full ${key.replace(/([A-Z])/g, " $1").toLowerCase()}, or leave the masked value unchanged.`;
    }
  }
  return null;
}

export function toBankDetailsPayload(
  form: BankDetailsPayload,
): BankDetailsPayload {
  return {
    accountHolder: form.accountHolder.trim(),
    bankName: form.bankName.trim(),
    branchName: form.branchName.trim(),
    branchCode: form.branchCode.trim(),
    accountNumber: form.accountNumber.trim(),
    accountType: form.accountType.trim(),
  };
}

export function isBankDetailsComplete(
  data: BankDetailsRecord | BankDetailsPayload | null | undefined,
): boolean {
  if (!data) return false;
  if ("isComplete" in data && typeof data.isComplete === "boolean") {
    return data.isComplete;
  }
  return validateBankDetails(data as BankDetailsPayload) === null;
}
