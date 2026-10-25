import * as SecureStore from "expo-secure-store";

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

export type AuthenticatedAssetSource = {
  uri: string;
  headers?: Record<string, string>;
};

async function readAuthToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync("authToken");
  } catch {
    return null;
  }
}

/**
 * Image / WebView / FileSystem source for gated static assets
 * (prescriptions, ID docs, certificates).
 */
export async function buildAuthenticatedAssetSource(
  folder: string,
  fileName?: string | null,
): Promise<AuthenticatedAssetSource | null> {
  const uri = buildBackendAssetUrl(folder, fileName);
  if (!uri) return null;
  return attachAuthToAssetUrl(uri);
}

export async function attachAuthToAssetUrl(
  uri: string,
): Promise<AuthenticatedAssetSource> {
  const token = await readAuthToken();
  if (!token) return { uri };
  return {
    uri,
    headers: { "x-access-token": `Bearer ${token}` },
  };
}

/** For WebBrowser / links that cannot send custom headers. */
export async function withAccessTokenQuery(uri: string): Promise<string> {
  const token = await readAuthToken();
  if (!token) return uri;
  const sep = uri.includes("?") ? "&" : "?";
  return `${uri}${sep}access_token=${encodeURIComponent(token)}`;
}