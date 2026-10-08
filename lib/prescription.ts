import apiClient from "./api";

export interface PrescriptionFile {
  uri: string;
  name: string;
  mimeType: string;
}

export type PrescriptionSource = "patient_pharmacy" | "provider_issued";

export interface PrescriptionRecord {
  _id: string;
  requestId?: string | { _id: string };
  patientId?: string | { _id: string; fullname?: string };
  issuerId?: string | { _id: string; fullname?: string; role?: string };
  pharmacistId?: string | { _id: string; fullname?: string };
  source?: PrescriptionSource;
  status:
    | "pending_review"
    | "accepted"
    | "rejected"
    | "cancelled"
    | "issued";
  prescriptionImage: string | null;
  fileType: "image" | "pdf" | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function normalizeUploadUri(uri: string): string {
  if (!uri) return uri;
  // Android content/file URIs are fine as-is; ensure file paths have a scheme
  if (uri.startsWith("/") && !uri.startsWith("file://")) {
    return `file://${uri}`;
  }
  return uri;
}

async function postMultipartPrescription({
  endpoint,
  method,
  file,
  requestId,
}: {
  endpoint: string;
  method: "POST" | "PATCH";
  file: PrescriptionFile;
  requestId?: string;
}): Promise<PrescriptionRecord> {
  const formData = new FormData();
  formData.append("prescriptionImage", {
    uri: normalizeUploadUri(file.uri),
    name: file.name || `prescription_${Date.now()}.jpg`,
    type: file.mimeType || "application/octet-stream",
  } as any);

  if (requestId) {
    formData.append("requestId", requestId);
  }

  try {
    const response = await apiClient.request({
      url: endpoint,
      method,
      data: formData,
      headers: {
        "Content-Type": "multipart/form-data",
        Accept: "application/json",
      },
    });

    return response.data?.prescription as PrescriptionRecord;
  } catch (error: any) {
    const message =
      error?.response?.data?.message ||
      error?.message ||
      "Upload failed.";
    throw new Error(message);
  }
}

/** Patient pharmacy-flow upload / replace */
export async function uploadPrescription<T = PrescriptionRecord>({
  requestId,
  prescriptionId,
  file,
}: {
  requestId?: string;
  prescriptionId?: string | null;
  file: PrescriptionFile;
}): Promise<T> {
  if (!prescriptionId && !requestId) {
    throw new Error("requestId is required to upload a new prescription.");
  }

  const endpoint = prescriptionId
    ? `/app/prescription/${prescriptionId}`
    : `/app/prescription`;

  return postMultipartPrescription({
    endpoint,
    method: prescriptionId ? "PATCH" : "POST",
    file,
    requestId: prescriptionId ? undefined : requestId,
  }) as Promise<T>;
}

/** Doctor / prescribing nurse — create clinical prescription */
export async function uploadProviderPrescription(
  requestId: string,
  file: PrescriptionFile,
): Promise<PrescriptionRecord> {
  return postMultipartPrescription({
    endpoint: `/app/prescription/provider`,
    method: "POST",
    file,
    requestId,
  });
}

/** Doctor / prescribing nurse — replace clinical prescription within window */
export async function updateProviderPrescription(
  prescriptionId: string,
  file: PrescriptionFile,
): Promise<PrescriptionRecord> {
  return postMultipartPrescription({
    endpoint: `/app/prescription/provider/${prescriptionId}`,
    method: "PATCH",
    file,
  });
}

export async function getPrescriptionByRequest(
  requestId: string,
): Promise<PrescriptionRecord | null> {
  try {
    const res = await apiClient.get(`/app/prescription/by-request/${requestId}`);
    return (res.data?.prescription as PrescriptionRecord) || null;
  } catch (error: any) {
    if (error?.response?.status === 404) {
      return null;
    }
    throw error;
  }
}
