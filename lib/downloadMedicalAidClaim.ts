import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from "expo-secure-store";
import * as Sharing from "expo-sharing";
import { API_BASE_URL } from "./backend";

type ClaimDownloadInput = {
  consultationId: string;
  filenameHint?: string | null;
};

async function getAuthToken() {
  const token = await SecureStore.getItemAsync("authToken");
  if (!token) {
    throw new Error("You must be signed in to download a claim.");
  }
  return token;
}

function buildLocalFilename(filenameHint?: string | null) {
  const safeHint = (filenameHint || "claim")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return `medical_aid_${safeHint || "claim"}_${Date.now()}.pdf`;
}

/**
 * Download a claim PDF to local cache and return the file URI.
 */
export async function fetchMedicalAidClaimFile({
  consultationId,
  filenameHint,
}: ClaimDownloadInput): Promise<string> {
  if (!consultationId) {
    throw new Error("Consultation id is missing.");
  }

  const token = await getAuthToken();
  const localName = buildLocalFilename(filenameHint);
  const targetUri = `${FileSystem.cacheDirectory}${localName}`;
  const url = `${API_BASE_URL}/app/medical-aid/consultations/${consultationId}/claim-pdf`;

  const result = await FileSystem.downloadAsync(url, targetUri, {
    headers: {
      "x-access-token": `Bearer ${token}`,
    },
  });

  if (result.status !== 200) {
    throw new Error("Could not download the medical aid claim PDF.");
  }

  return result.uri;
}

/**
 * Download multiple consultations as one combined claim PDF.
 * Returns local file URI and the consultation ids included in the PDF.
 */
export async function fetchMedicalAidClaimsBatchFile(
  items: ClaimDownloadInput[],
): Promise<{ uri: string; downloadedIds: string[] }> {
  if (!items.length) {
    throw new Error("Select at least one claim to download.");
  }

  const token = await getAuthToken();
  const ids = items.map((item) => item.consultationId).filter(Boolean);
  if (!ids.length) {
    throw new Error("Select at least one claim to download.");
  }

  const filenameHint =
    items.length === 1
      ? items[0].filenameHint
      : `combined_${items.length}_claims`;
  const localName = buildLocalFilename(filenameHint);
  const targetUri = `${FileSystem.cacheDirectory}${localName}`;
  const url = `${API_BASE_URL}/app/medical-aid/consultations/claim-pdf`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-access-token": `Bearer ${token}`,
    },
    body: JSON.stringify({ ids }),
  });

  if (!response.ok) {
    let message = "Could not download the medical aid claim PDF.";
    try {
      const body = await response.json();
      if (body?.message) message = body.message;
    } catch {
      // ignore non-JSON error bodies
    }
    throw new Error(message);
  }

  const downloadedIdsHeader = response.headers.get("X-Claim-Downloaded-Ids");
  const downloadedIds = downloadedIdsHeader
    ? downloadedIdsHeader
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    : ids;

  const arrayBuffer = await response.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  // Convert to base64 in chunks to avoid call-stack limits on large PDFs
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const base64 = globalThis.btoa(binary);

  await FileSystem.writeAsStringAsync(targetUri, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  return { uri: targetUri, downloadedIds };
}

async function shareClaimUri(uri: string, dialogTitle: string) {
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      dialogTitle,
      UTI: "com.adobe.pdf",
    });
    return;
  }

  Alert.alert(
    "Downloaded",
    Platform.OS === "ios"
      ? "Claim saved. Sharing is not available on this device."
      : `Claim saved to:\n${uri}`,
  );
}

/**
 * Download a medical-aid claim statement PDF for a consultation and open
 * the native share/save sheet so the provider can collect/submit it.
 */
export async function downloadMedicalAidClaim(
  input: ClaimDownloadInput,
): Promise<void> {
  const uri = await fetchMedicalAidClaimFile(input);
  await shareClaimUri(uri, "Save medical aid claim");
}

/**
 * Download multiple consultations as a single combined claim PDF,
 * then open the share/save sheet once.
 */
export async function downloadMedicalAidClaims(
  items: ClaimDownloadInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ downloaded: number; failed: number; downloadedIds: string[] }> {
  if (!items.length) {
    throw new Error("Select at least one claim to download.");
  }

  onProgress?.(0, 1);

  try {
    const { uri, downloadedIds } = await fetchMedicalAidClaimsBatchFile(items);
    onProgress?.(1, 1);
    await shareClaimUri(
      uri,
      items.length > 1
        ? "Save combined medical aid claim"
        : "Save medical aid claim",
    );

    return {
      downloaded: downloadedIds.length,
      failed: Math.max(0, items.length - downloadedIds.length),
      downloadedIds,
    };
  } catch (err) {
    onProgress?.(1, 1);
    throw err;
  }
}
