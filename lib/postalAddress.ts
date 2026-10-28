export type PostalAddressType = "po_box" | "private_bag" | "street";

export type PostalAddressPayload = {
  addressee: string;
  addressType: PostalAddressType;
  boxNumber?: string;
  bagNumber?: string;
  unitOrAdditional?: string;
  premises?: string;
  subLocality?: string;
  locality?: string;
  postOffice: string;
  postcode: string;
  country?: string;
};

export type PostalAddressRecord = PostalAddressPayload & {
  id?: string;
  userId?: string;
  formatted?: string;
  updatedAt?: string;
  createdAt?: string;
};

export const emptyPostalAddress = (
  defaults?: Partial<PostalAddressPayload>,
): PostalAddressPayload => ({
  addressee: defaults?.addressee || "",
  addressType: defaults?.addressType || "po_box",
  boxNumber: defaults?.boxNumber || "",
  bagNumber: defaults?.bagNumber || "",
  unitOrAdditional: defaults?.unitOrAdditional || "",
  premises: defaults?.premises || "",
  subLocality: defaults?.subLocality || "",
  locality: defaults?.locality || "",
  postOffice: defaults?.postOffice || "",
  postcode: defaults?.postcode || "",
  country: defaults?.country || "NAMIBIA",
});

/** Client-side Namibia postal validation. Returns error message or null. */
export function validatePostalAddress(
  address: PostalAddressPayload,
): string | null {
  const addressee = String(address.addressee || "").trim();
  const addressType = address.addressType;
  const postOffice = String(address.postOffice || "").trim();
  const postcode = String(address.postcode || "").trim();

  if (!addressee) return "Full name is required.";
  if (!["po_box", "private_bag", "street"].includes(addressType)) {
    return "Please select an address type.";
  }
  if (!postOffice) return "Delivery post office / postal area is required.";
  if (!/^\d{5}$/.test(postcode)) {
    return "Postcode must be exactly 5 digits (NamPost format).";
  }

  if (addressType === "po_box" && !String(address.boxNumber || "").trim()) {
    return "PO Box number is required.";
  }
  if (addressType === "private_bag" && !String(address.bagNumber || "").trim()) {
    return "Private Bag number is required.";
  }
  if (addressType === "street" && !String(address.premises || "").trim()) {
    return "Street / premises line is required for physical addresses.";
  }

  return null;
}

export function formatPostalAddressPreview(
  address: PostalAddressPayload,
): string {
  const lines: string[] = [];
  if (address.addressee?.trim()) lines.push(address.addressee.trim());

  if (address.addressType === "po_box") {
    lines.push(`PO Box ${String(address.boxNumber || "").trim()}`);
  } else if (address.addressType === "private_bag") {
    lines.push(`Private Bag ${String(address.bagNumber || "").trim()}`);
  } else {
    if (address.unitOrAdditional?.trim()) {
      lines.push(address.unitOrAdditional.trim());
    }
    if (address.premises?.trim()) lines.push(address.premises.trim());
    if (address.subLocality?.trim()) lines.push(address.subLocality.trim());
    if (address.locality?.trim()) lines.push(address.locality.trim());
  }

  if (address.postOffice?.trim()) {
    lines.push(address.postOffice.trim().toUpperCase());
  }
  if (address.postcode?.trim()) lines.push(address.postcode.trim());
  lines.push((address.country || "NAMIBIA").trim().toUpperCase());
  return lines.filter(Boolean).join("\n");
}

export function toPostalAddressPayload(
  address: PostalAddressPayload,
): PostalAddressPayload {
  const base: PostalAddressPayload = {
    addressee: address.addressee.trim(),
    addressType: address.addressType,
    postOffice: address.postOffice.trim().toUpperCase(),
    postcode: address.postcode.trim(),
    country: (address.country || "NAMIBIA").trim().toUpperCase() || "NAMIBIA",
  };

  if (address.addressType === "po_box") {
    base.boxNumber = String(address.boxNumber || "").trim();
  } else if (address.addressType === "private_bag") {
    base.bagNumber = String(address.bagNumber || "").trim();
  } else {
    const unit = String(address.unitOrAdditional || "").trim();
    const premises = String(address.premises || "").trim();
    const subLocality = String(address.subLocality || "").trim();
    const locality = String(address.locality || "").trim();
    if (unit) base.unitOrAdditional = unit;
    base.premises = premises;
    if (subLocality) base.subLocality = subLocality;
    if (locality) base.locality = locality;
  }

  return base;
}
