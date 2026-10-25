// In lib/api.ts

import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { API_BASE_URL } from "./backend";
import { isNetworkError } from "./networkDetector";
import {
  OFFLINE_MESSAGE,
  SERVER_SLOW_MESSAGE,
} from "./userFacingError";

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000, // 120 second timeout for large file uploads
});

// Lets AuthContext react when the server rejects our token (expired or
// otherwise). Without this the stored token is cleared but the in-memory
// session survives, leaving the user "signed in" while every call fails.
type UnauthorizedHandler = () => void;
let onUnauthorized: UnauthorizedHandler | null = null;

export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorized = handler;
};

let appTokenInflight: Promise<string | null> | null = null;

function isRetrieveAppTokenUrl(url?: string): boolean {
  return String(url || "").includes("/app/auth/retrieve-jwt-token");
}

/** Fetch/store bootstrap app token (used by pre-login routes like send-otp). */
export async function ensureAppToken(): Promise<string | null> {
  const existing = await SecureStore.getItemAsync("appToken");
  if (existing) return existing;

  if (appTokenInflight) return appTokenInflight;

  appTokenInflight = (async () => {
    try {
      // Raw axios — avoids this client's interceptor (and recursion).
      const response = await axios.get(
        `${API_BASE_URL}/app/auth/retrieve-jwt-token`,
        { timeout: 30000 },
      );
      const token = response.data?.token;
      if (typeof token === "string" && token.length > 0) {
        await SecureStore.setItemAsync("appToken", token);
        return token;
      }
      return null;
    } catch (error) {
      console.error("❌ Failed to ensure app token:", error);
      return null;
    } finally {
      appTokenInflight = null;
    }
  })();

  return appTokenInflight;
}

// Add request interceptor to increase timeout for multipart/form-data (file uploads)
apiClient.interceptors.request.use(
  async (config) => {
    if (!config.headers) {
      config.headers = {} as typeof config.headers;
    }

    const token = await SecureStore.getItemAsync("authToken");
    if (token) {
      // User session — used by authenticated app routes.
      config.headers["Authorization"] = `Bearer ${token}`;
      config.headers["x-access-token"] = `Bearer ${token}`;
    }

    // Bootstrap token for pre-login routes (/auth/send-otp, verify-otp, etc.)
    if (!isRetrieveAppTokenUrl(config.url)) {
      const appToken = await ensureAppToken();
      if (appToken) {
        config.headers["data-access-token"] = `Bearer ${appToken}`;
      }
    }

    if (config.headers["Content-Type"] === "multipart/form-data") {
      config.timeout = 180000; // 180 seconds (3 minutes) for file uploads
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Normalize network/timeout errors so screens never show raw axios text
// like "timeout of 120000ms exceeded" or "Request timeout".
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.code === "ECONNABORTED" || /timeout/i.test(error.message || "")) {
      console.error("[TIMEOUT] Request took too long.");
      const timeoutError = new Error(SERVER_SLOW_MESSAGE) as Error & {
        isTimeout: boolean;
        code?: string;
        response?: unknown;
        request?: unknown;
      };
      timeoutError.isTimeout = true;
      timeoutError.code = error.code;
      timeoutError.response = error.response;
      timeoutError.request = error.request;
      return Promise.reject(timeoutError);
    }

    // Bootstrap app-token invalid — clear and let the next request refresh it.
    const status = error.response?.status;
    const message = error.response?.data?.message;
    if (status === 400 && message === "Invalid token.") {
      await SecureStore.deleteItemAsync("appToken").catch(() => {});
    }

    if (status === 401) {
      // Only clear the user session for user-auth failures — not missing bootstrap token.
      const usedUserAuth = Boolean(
        error.config?.headers?.["x-access-token"] ||
          error.config?.headers?.Authorization ||
          error.config?.headers?.authorization,
      );
      const missingBootstrap =
        typeof message === "string" &&
        (/wait a moment/i.test(message) ||
          /no authorization header/i.test(message) ||
          /no token provided/i.test(message));

      if (usedUserAuth && !missingBootstrap) {
        await SecureStore.deleteItemAsync("authToken");
        await SecureStore.deleteItemAsync("user");

        console.error(
          "[UNAUTHORIZED] Authentication failed. Please log in again.",
        );

        onUnauthorized?.();
      } else if (missingBootstrap) {
        await SecureStore.deleteItemAsync("appToken").catch(() => {});
      }
    } else if (isNetworkError(error)) {
      const offlineError = new Error(OFFLINE_MESSAGE) as Error & {
        isOffline: boolean;
        code?: string;
        response?: unknown;
        request?: unknown;
      };
      offlineError.isOffline = true;
      offlineError.code = error.code;
      offlineError.response = error.response;
      offlineError.request = error.request;
      return Promise.reject(offlineError);
    }
    return Promise.reject(error);
  },
);

export default apiClient;
