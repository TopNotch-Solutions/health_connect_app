import { useAuth } from "@/context/AuthContext";
import apiClient from "@/lib/api";
import { Feather } from "@expo/vector-icons";
import { Tabs, useFocusEffect, usePathname, useRouter, useSegments } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// Separate component for header right to ensure proper re-rendering
const HeaderRight = ({ unreadCount, isLoggingOut, onLogout, onNotificationsPress }: {
  unreadCount: number;
  isLoggingOut: boolean;
  onLogout: () => void;
  onNotificationsPress: () => void;
}) => (
  <View style={styles.headerContainer}>
    {/* Notification button */}
    <TouchableOpacity
      onPress={onNotificationsPress}
      style={styles.iconButton}
      accessibilityRole="button"
      accessibilityLabel="Open notifications"
    >
      <View style={styles.bellContainer}>
        <Feather name="bell" size={22} />
        {unreadCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {unreadCount > 100 ? '99+' : unreadCount.toString()}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>

    {/* Logout button */}
    <TouchableOpacity
      onPress={onLogout}
      disabled={isLoggingOut}
      style={styles.logoutButton}
      accessibilityRole="button"
      accessibilityLabel="Logout"
    >
      <Feather name="log-out" size={20} color="#fff" />
    </TouchableOpacity>
  </View>
);

export default function ProviderTabsLayout() {
  const { logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [headerKey, setHeaderKey] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const segments = useSegments();
  const insets = useSafeAreaInsets();

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.userId) return;
    try {
      console.log('Fetching unread count for user:', user.userId);
      const response = await apiClient.get('/app/notification/unread-count/');
      console.log('Unread count response:', response.data);
      
      // API response structure: { status: true, data: { unReadCount: number } }
      const count = response.data?.data?.unReadCount || 0;
      console.log('Parsed unread count:', count);
      setUnreadCount(count); // Store actual count
      setHeaderKey(prev => prev + 1); // Force header re-render
    } catch (error: any) {
      console.error("Error fetching unread count:", error);
      console.error("Error details:", error.response?.data);
      setUnreadCount(0);
    }
  }, [user?.userId]);

  // Fetch count when screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchUnreadCount();
    }, [fetchUnreadCount])
  );

  // Fetch count when route changes (user navigates between tabs/pages)
  useEffect(() => {
    fetchUnreadCount();
  }, [pathname, fetchUnreadCount]);

  // Fetch count when segments change (tab navigation)
  useEffect(() => {
    fetchUnreadCount();
  }, [segments, fetchUnreadCount]);

  // Refresh count when returning from notifications screen
  useEffect(() => {
    // If we're not on notifications page, refresh count
    // This handles the case when user returns from notifications
    if (!pathname.includes('notifications')) {
      const timer = setTimeout(() => {
        fetchUnreadCount();
      }, 300); // Small delay to ensure navigation is complete
      return () => clearTimeout(timer);
    }
  }, [pathname, fetchUnreadCount]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      await logout();
      // Always navigate to the root sign-in route (outside the protected (app) group).
      router.replace("/(root)/sign-in");
    } finally {
      setIsLoggingOut(false);
    }
  };

  // Create headerRight function that will be recreated when unreadCount changes
  const headerRightCallback = useCallback(() => (
    <HeaderRight
      key={headerKey}
      unreadCount={unreadCount}
      isLoggingOut={isLoggingOut}
      onLogout={handleLogout}
      onNotificationsPress={() => router.push("/notifications")}
    />
  ), [unreadCount, isLoggingOut, router, headerKey]);

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: true,
        tabBarStyle: {
          height: 64 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          marginBottom: 6,
        },
        headerRight: headerRightCallback,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size }) => (
            <Feather name="inbox" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => (
            <Feather name="credit-card" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="issues"
        options={{
          title: "Issues",
          tabBarIcon: ({ color, size }) => (
            <Feather name="book" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transaction History",
          href: null,
          tabBarIcon: ({ color, size }) => (
            <Feather name="credit-card" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  iconButton: {
    padding: 8,
    marginRight: 12,
  },
  bellContainer: {
    position: "relative",
  },
  badge: {
    position: "absolute",
    top: -4,
    right: -8,
    backgroundColor: "#ef4444",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  logoutText: {
    color: "#fff",
    fontWeight: "600",
    marginLeft: 6,
  },
});