// TEMP for local testing — hardcode so EXPO_PUBLIC_* / Metro cache cannot
// override. Restore env-based resolveBackendUrl before shipping.
export const BACKEND_URL = "https://apihealthconnect.kopanovertex.com";

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
