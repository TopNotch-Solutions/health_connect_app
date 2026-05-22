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
