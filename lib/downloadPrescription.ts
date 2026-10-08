import { Alert, Platform } from "react-native";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

function extensionForFile(fileType?: "image" | "pdf" | null, filename?: string) {
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext) return ext;
  }
  return fileType === "pdf" ? "pdf" : "jpg";
}

/**
 * Download a prescription asset and open the native share/save sheet.
 */
export async function downloadPrescriptionFile({
  url,
  fileType,
  filenameHint,
}: {
  url: string;
  fileType?: "image" | "pdf" | null;
  filenameHint?: string | null;
}): Promise<void> {
  if (!url) {
    throw new Error("Prescription file URL is missing.");
  }

  const ext = extensionForFile(fileType, filenameHint || undefined);
  const localName = `prescription_${Date.now()}.${ext}`;
  const targetUri = `${FileSystem.cacheDirectory}${localName}`;

  const result = await FileSystem.downloadAsync(url, targetUri);
  if (result.status !== 200) {
    throw new Error("Could not download the prescription file.");
  }

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType: fileType === "pdf" ? "application/pdf" : `image/${ext === "png" ? "png" : "jpeg"}`,
      dialogTitle: "Save prescription",
      UTI: fileType === "pdf" ? "com.adobe.pdf" : "public.image",
    });
    return;
  }

  // Fallback: tell the user where it was saved
  Alert.alert(
    "Downloaded",
    Platform.OS === "ios"
      ? "Prescription saved. Sharing is not available on this device."
      : `Prescription saved to:\n${result.uri}`,
  );
}
