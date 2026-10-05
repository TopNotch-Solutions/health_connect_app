import apiClient from "@/lib/api";
import { useFocusEffect, usePathname } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";

const MIN_FETCH_INTERVAL_MS = 30_000;
const POLL_INTERVAL_MS = 60_000;

/**
 * Fetches the unread notification badge count with throttling so tab/route
 * changes do not hammer the rate-limited unread-count endpoint.
 */
export function useUnreadNotificationCount(enabled: boolean) {
  const [unreadCount, setUnreadCount] = useState(0);
  const pathname = usePathname();
  const lastFetchAt = useRef(0);
  const inFlight = useRef(false);
  const wasOnNotifications = useRef(false);

  const fetchUnreadCount = useCallback(
    async (force = false) => {
      if (!enabled || inFlight.current) return;

      const now = Date.now();
      if (!force && now - lastFetchAt.current < MIN_FETCH_INTERVAL_MS) {
        return;
      }

      inFlight.current = true;
      lastFetchAt.current = now;

      try {
        const response = await apiClient.get(
          "/app/notification/unread-count/",
        );
        const count = response.data?.data?.unReadCount || 0;
        setUnreadCount(count);
      } catch (error: any) {
        const status = error?.response?.status;
        // Keep the last known badge on rate-limit / transient errors
        if (status && status !== 429) {
          console.warn("Unread count fetch failed:", status);
        }
      } finally {
        inFlight.current = false;
      }
    },
    [enabled],
  );

  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();

      const interval = setInterval(() => {
        fetchUnreadCount();
      }, POLL_INTERVAL_MS);

      return () => clearInterval(interval);
    }, [fetchUnreadCount]),
  );

  // Force a refresh when returning from the notifications screen
  useEffect(() => {
    const onNotifications = pathname.includes("notifications");
    if (wasOnNotifications.current && !onNotifications) {
      fetchUnreadCount(true);
    }
    wasOnNotifications.current = onNotifications;
  }, [pathname, fetchUnreadCount]);

  return unreadCount;
}
