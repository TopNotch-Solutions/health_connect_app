import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";
import {
  NetworkStatus,
  subscribeToNetworkStatus,
  toNetworkStatus,
} from "../lib/networkDetector";

/** Live connectivity for banners / disabling actions while offline. */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = useState<NetworkStatus>({
    isConnected: true,
    isInternetReachable: null,
    isOnline: true,
  });

  useEffect(() => {
    void NetInfo.fetch().then((state) => {
      setStatus(toNetworkStatus(state));
    });

    return subscribeToNetworkStatus(setStatus);
  }, []);

  return status;
}
