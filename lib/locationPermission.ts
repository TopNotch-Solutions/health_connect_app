import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";

const LOCATION_PERMISSION_PROMPTED_KEY =
  "health_connect_location_permission_prompted";

export type LocationPermissionResult = {
  granted: boolean;
  status: Location.PermissionStatus;
  canAskAgain: boolean;
};

/**
 * Checks foreground location permission. Only shows the system dialog once per
 * install (first time status is undetermined). Later calls use the saved OS status.
 */
export async function ensureForegroundLocationPermission(
  options: { requestIfNeeded?: boolean } = {},
): Promise<LocationPermissionResult> {
  const requestIfNeeded = options.requestIfNeeded !== false;

  let { status, canAskAgain } =
    await Location.getForegroundPermissionsAsync();

  if (status === Location.PermissionStatus.GRANTED) {
    return {
      granted: true,
      status,
      canAskAgain: canAskAgain ?? true,
    };
  }

  if (!requestIfNeeded) {
    return {
      granted: false,
      status,
      canAskAgain: canAskAgain ?? false,
    };
  }

  if (status !== Location.PermissionStatus.UNDETERMINED) {
    return {
      granted: false,
      status,
      canAskAgain: canAskAgain ?? false,
    };
  }

  const alreadyPrompted = await AsyncStorage.getItem(
    LOCATION_PERMISSION_PROMPTED_KEY,
  );
  if (alreadyPrompted === "true") {
    return {
      granted: false,
      status,
      canAskAgain: canAskAgain ?? false,
    };
  }

  await AsyncStorage.setItem(LOCATION_PERMISSION_PROMPTED_KEY, "true");
  const response = await Location.requestForegroundPermissionsAsync();
  status = response.status;
  canAskAgain = response.canAskAgain ?? false;

  return {
    granted: status === Location.PermissionStatus.GRANTED,
    status,
    canAskAgain,
  };
}

/** Current position with a hard timeout — High accuracy can hang indefinitely on some devices. */
export async function getCurrentPositionWithTimeout(
  options: {
    timeoutMs?: number;
    accuracy?: Location.LocationAccuracy;
  } = {},
): Promise<Location.LocationObject> {
  const timeoutMs = options.timeoutMs ?? 12000;
  const accuracy = options.accuracy ?? Location.Accuracy.Balanced;

  const locationPromise = Location.getCurrentPositionAsync({ accuracy });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          "Unable to get your current location in time. Check GPS is on and try again.",
        ),
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([locationPromise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Prefer last-known / cached coords so accept can emit immediately.
 * Fresh GPS is only fetched when nothing usable is available.
 */
export async function resolveProviderCoordsForAccept(
  cached?: { latitude: number; longitude: number } | null,
): Promise<{ latitude: number; longitude: number }> {
  if (
    cached &&
    typeof cached.latitude === "number" &&
    typeof cached.longitude === "number" &&
    Number.isFinite(cached.latitude) &&
    Number.isFinite(cached.longitude)
  ) {
    return cached;
  }

  try {
    const lastKnown = await Location.getLastKnownPositionAsync();
    if (lastKnown?.coords) {
      return {
        latitude: lastKnown.coords.latitude,
        longitude: lastKnown.coords.longitude,
      };
    }
  } catch {
    // fall through to live fix
  }

  const loc = await getCurrentPositionWithTimeout({ timeoutMs: 8000 });
  return {
    latitude: loc.coords.latitude,
    longitude: loc.coords.longitude,
  };
}
