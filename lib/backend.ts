import * as Device from "expo-device";
import { Platform } from "react-native";

// TEMP for local testing — hardcode so EXPO_PUBLIC_* / Metro cache cannot
// override. Restore env-based resolveBackendUrl before shipping.
export const BACKEND_URL = "http://172.20.10.2:4000";

export const API_BASE_URL = `${BACKEND_URL}/api`;

console.log(
  "[backend] HARDCODED BACKEND_URL =",
  BACKEND_URL,
  "| platform =",
  Platform.OS,
  "| isDevice =",
  Device.isDevice,
);

export const buildBackendAssetUrl = (
  folder: string,
  fileName?: string | null,
): string | null => {
  if (!fileName) return null;

  const normalizedFolder = folder.replace(/^\/+|\/+$/g, "");
  const normalizedFileName = fileName.replace(/^\/+/, "");
  return `${BACKEND_URL}/${normalizedFolder}/${normalizedFileName}`;
};
