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

function buildLocalFilename(filenameHint?: string | null, index?: number) {
  const safeHint = (filenameHint || "claim")
    .replace(/[^a-z0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  const suffix = typeof index === "number" ? `_${index + 1}` : "";
  return `medical_aid_${safeHint || "claim"}${suffix}_${Date.now()}.pdf`;
}

/**
 * Download a claim PDF to local cache and return the file URI.
 */
export async function fetchMedicalAidClaimFile({
  consultationId,
  filenameHint,
  index,
}: ClaimDownloadInput & { index?: number }): Promise<string> {
  if (!consultationId) {
    throw new Error("Consultation id is missing.");
  }

  const token = await getAuthToken();
  const localName = buildLocalFilename(filenameHint, index);
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
 * Download multiple claim PDFs, then open the share/save sheet for each
 * one in sequence so the provider can collect several claims at once.
 */
export async function downloadMedicalAidClaims(
  items: ClaimDownloadInput[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ downloaded: number; failed: number; downloadedIds: string[] }> {
  if (!items.length) {
    throw new Error("Select at least one claim to download.");
  }

  const downloaded: { id: string; uri: string }[] = [];
  let failed = 0;

  for (let i = 0; i < items.length; i += 1) {
    try {
      const uri = await fetchMedicalAidClaimFile({
        ...items[i],
        index: i,
      });
      downloaded.push({ id: items[i].consultationId, uri });
    } catch (err) {
      console.error("Batch claim download failed for item:", items[i], err);
      failed += 1;
    }
    onProgress?.(i + 1, items.length);
  }

  for (let i = 0; i < downloaded.length; i += 1) {
    await shareClaimUri(
      downloaded[i].uri,
      downloaded.length > 1
        ? `Save claim ${i + 1} of ${downloaded.length}`
        : "Save medical aid claim",
    );
  }

  return {
    downloaded: downloaded.length,
    failed,
    downloadedIds: downloaded.map((item) => item.id),
  };
}
