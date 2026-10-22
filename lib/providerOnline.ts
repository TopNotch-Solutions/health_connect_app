/**
 * Shared provider Online/Offline flag for the current session.
 * Home owns the toggle + AsyncStorage; alerts and other screens read this
 * so new-request voice/ring only fire while the provider is Online.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

let providerOnline = false;

export function providerOnlineStorageKey(userId: string): string {
  return `provider-online-state-${userId}`;
}

/** In-memory Online flag used by alerts (synced from Home). */
export function isProviderOnline(): boolean {
  return providerOnline;
}

/** Call whenever the Home toggle (or persisted restore) changes. */
export function setProviderOnline(online: boolean): void {
  providerOnline = !!online;
}

/**
 * Restore Online from AsyncStorage (e.g. before Home mounts).
 * Unverified providers are always treated as offline.
 */
export async function hydrateProviderOnline(
  userId: string,
  isDocumentVerified?: boolean,
): Promise<boolean> {
  if (!userId) {
    providerOnline = false;
    return false;
  }

  if (!isDocumentVerified) {
    providerOnline = false;
    try {
      await AsyncStorage.setItem(providerOnlineStorageKey(userId), "false");
    } catch {
      // ignore
    }
    return false;
  }

  try {
    const stored = await AsyncStorage.getItem(providerOnlineStorageKey(userId));
    providerOnline = stored === "true";
  } catch {
    providerOnline = false;
  }
  return providerOnline;
}
