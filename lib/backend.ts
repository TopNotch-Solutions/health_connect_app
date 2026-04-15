import * as Device from "expo-device";
import { Platform } from "react-native";

const DEFAULT_DEVICE_BACKEND_URL = "https://apihealthconnect.kopanovertex.com";
const DEFAULT_ANDROID_EMULATOR_BACKEND_URL = "http://10.0.2.2:4000";

const resolveBackendUrl = () => {
  const explicitUrl = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (explicitUrl) {
    return explicitUrl;
  }

  const deviceUrl =
    process.env.EXPO_PUBLIC_BACKEND_URL_DEVICE || DEFAULT_DEVICE_BACKEND_URL;
  const androidEmulatorUrl =
    process.env.EXPO_PUBLIC_BACKEND_URL_ANDROID_EMULATOR ||
    DEFAULT_ANDROID_EMULATOR_BACKEND_URL;

  const isAndroidEmulator = Platform.OS === "android" && !Device.isDevice;

  return isAndroidEmulator ? androidEmulatorUrl : deviceUrl;
};

export const BACKEND_URL = resolveBackendUrl();

export const API_BASE_URL = `${BACKEND_URL}/api`;

export const buildBackendAssetUrl = (
  folder: string,
  fileName?: string | null,
): string | null => {
  if (!fileName) return null;

  const normalizedFolder = folder.replace(/^\/+|\/+$/g, "");
  const normalizedFileName = fileName.replace(/^\/+/, "");
  return `${BACKEND_URL}/${normalizedFolder}/${normalizedFileName}`;
};
