export type MedicalAidIcdCode = {
  _id?: string;
  ICD_10_code?: string | null;
  MAF?: string | null;
  price?: number | null;
  secondaryICD_10_code?: string | null;
  secondaryMAF?: string | null;
  secondaryPrice?: number | null;
};

export type MedicalAidIcdPricing = {
  primaryPrice: number;
  secondaryPrice: number | null;
  secondaryCode: string | null;
  consultationCost: number;
};

/**
 * Medical-aid consultation cost from ICD-10 code(s):
 * - primary + secondaryPrice when the first record has a second ICD
 * - otherwise first record price + second record price when two ICDs are linked
 */
export function resolveMedicalAidIcdPricing(
  icd10Codes: MedicalAidIcdCode[] | null | undefined,
): MedicalAidIcdPricing | null {
  const list = Array.isArray(icd10Codes) ? icd10Codes.filter(Boolean) : [];
  if (!list.length) return null;

  const primary = list[0];
  const primaryPrice = Number(primary.price);
  if (!Number.isFinite(primaryPrice) || primaryPrice < 0) return null;

  if (
    primary.secondaryICD_10_code &&
    String(primary.secondaryICD_10_code).trim() !== ""
  ) {
    const secondaryPrice =
      primary.secondaryPrice != null &&
      Number.isFinite(Number(primary.secondaryPrice))
        ? Number(primary.secondaryPrice)
        : null;

    return {
      primaryPrice,
      secondaryPrice,
      secondaryCode: String(primary.secondaryICD_10_code).trim(),
      consultationCost:
        primaryPrice + (secondaryPrice != null ? secondaryPrice : 0),
    };
  }

  if (list.length >= 2) {
    const secondaryPrice = Number(list[1].price);
    if (Number.isFinite(secondaryPrice) && secondaryPrice >= 0) {
      return {
        primaryPrice,
        secondaryPrice,
        secondaryCode: list[1].ICD_10_code
          ? String(list[1].ICD_10_code).trim()
          : null,
        consultationCost: primaryPrice + secondaryPrice,
      };
    }
  }

  return {
    primaryPrice,
    secondaryPrice: null,
    secondaryCode: null,
    consultationCost: primaryPrice,
  };
}
