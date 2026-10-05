import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

export type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  isOnline: boolean;
};

/** True when the device has a usable internet connection. */
export function isNetworkOnline(state: NetInfoState | null): boolean {
  if (!state || state.isConnected === false) return false;
  // null means "unknown" on some platforms — treat as online if connected
  if (state.isInternetReachable === false) return false;
  return true;
}

export function toNetworkStatus(state: NetInfoState): NetworkStatus {
  const isConnected = state.isConnected === true;
  const isInternetReachable = state.isInternetReachable ?? null;
  return {
    isConnected,
    isInternetReachable,
    isOnline: isNetworkOnline(state),
  };
}

/** One-shot connectivity check. */
export async function checkIsOnline(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return isNetworkOnline(state);
}

/** Subscribe to connectivity changes. Returns an unsubscribe function. */
export function subscribeToNetworkStatus(
  listener: (status: NetworkStatus) => void,
): () => void {
  return NetInfo.addEventListener((state) => {
    listener(toNetworkStatus(state));
  });
}

/** Resolves when the device is online, or false after timeout. */
export async function waitUntilOnline(
  timeoutMs = 60_000,
): Promise<boolean> {
  if (await checkIsOnline()) return true;

  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      resolve(false);
    }, timeoutMs);

    const unsubscribe = subscribeToNetworkStatus((status) => {
      if (!status.isOnline || settled) return;
      settled = true;
      clearTimeout(timer);
      unsubscribe();
      resolve(true);
    });
  });
}

/** Axios / fetch failures with no server response (offline, timeout, DNS, etc.). */
export function isNetworkError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as {
    response?: unknown;
    request?: unknown;
    code?: string;
    message?: string;
    isTimeout?: boolean;
  };

  if (err.isTimeout) return true;
  if (!err.response && err.request) return true;

  const code = err.code ?? "";
  return (
    code === "ECONNABORTED" ||
    code === "ERR_NETWORK" ||
    code === "ENOTFOUND" ||
    code === "ECONNREFUSED" ||
    code === "ETIMEDOUT"
  );
}
