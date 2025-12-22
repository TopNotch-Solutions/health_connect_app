import { useAuth } from "@/context/AuthContext";
import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter, useFocusEffect, usePathname } from "expo-router";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import React, { useState, useCallback, useEffect } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import apiClient from "@/lib/api";

export default function ProviderTabsLayout() {
  const { logout, user } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  // Fetch unread notification count
  const fetchUnreadCount = useCallback(async () => {
    if (!user?.userId) return;
    try {
      console.log('Fetching unread count for user:', user.userId);
      const response = await apiClient.get(`/app/notification/unread-count/${user.userId}`);
      console.log('Unread count response:', response.data);
      
      // API response structure: { status: true, data: { unReadCount: number } }
      const count = response.data?.data?.unReadCount || 0;
      console.log('Parsed unread count:', count);
      setUnreadCount(count); // Store actual count
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

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      router.replace("/sign-in"); // back to the sign-in screen
    } finally {
      setIsLoggingOut(false);
    }
  };

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
        headerRight: () => (
          <View style={styles.headerContainer}>
            {/* Notification button */}
            <TouchableOpacity
              onPress={() => router.push("/notifications")}
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
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={styles.logoutButton}
              accessibilityRole="button"
              accessibilityLabel="Logout"
            >
              <Feather name="log-out" size={20} color="#fff" />
              
            </TouchableOpacity>
          </View>
        ),
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