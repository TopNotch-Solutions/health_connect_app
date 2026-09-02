import Constants from "expo-constants";
import { isRunningInExpoGo } from "expo";

/** True when running inside the Expo Go app (no custom native code). */
export function isExpoGoRuntime(): boolean {
  return Constants.appOwnership === "expo" || isRunningInExpoGo();
}
