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

// Add request interceptor to increase timeout for multipart/form-data (file uploads)
apiClient.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("authToken");
    if (token) {
      config.headers["x-access-token"] = `Bearer ${token}`;
    }

    const appToken = await SecureStore.getItemAsync("appToken");
    if (appToken) {
      config.headers["data-access-token"] = `Bearer ${appToken}`;
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

    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("authToken");
      await SecureStore.deleteItemAsync("user");

      console.error(
        "[UNAUTHORIZED] Authentication failed. Please log in again.",
      );

      // Drop the in-memory session too, so the protected layout redirects
      // to sign-in instead of leaving the user on a screen that cannot load.
      onUnauthorized?.();
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
