import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./backend";

export interface PrescriptionFile {
  uri: string;
  name: string;
  mimeType: string;
}

export async function uploadPrescription<T = any>({
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

  const formData = new FormData();
  formData.append("prescriptionImage", {
    uri: file.uri,
    name: file.name,
    type: file.mimeType,
  } as any);

  if (!prescriptionId && requestId) {
    formData.append("requestId", requestId);
  }

  const authToken = await SecureStore.getItemAsync("authToken");
  const appToken = await SecureStore.getItemAsync("appToken");

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  if (authToken) {
    headers["x-access-token"] = `Bearer ${authToken}`;
  }

  if (appToken) {
    headers["data-access-token"] = `Bearer ${appToken}`;
  }

  const endpoint = prescriptionId
    ? `${API_BASE_URL}/app/prescription/${prescriptionId}`
    : `${API_BASE_URL}/app/prescription`;

  const response = await fetch(endpoint, {
    method: prescriptionId ? "PATCH" : "POST",
    headers,
    body: formData,
  });

  const responseText = await response.text();
  let responseData: any = null;

  if (responseText) {
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = { message: responseText };
    }
  }

  if (!response.ok) {
    throw new Error(
      responseData?.message || `Upload failed with status ${response.status}`,
    );
  }

  return responseData?.prescription as T;
}
