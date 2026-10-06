import { useAuth } from "@/context/AuthContext";
import {
  HeaderBackButton,
  iosStackHeaderBackOptions,
} from "@/components/HeaderBackButton";
import { Feather } from "@expo/vector-icons";
import {
  Tabs,
  useRouter,
} from "expo-router";
import React, { useCallback, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getModernTabBarOptions } from "@/lib/modernTabBar";
import { useUnreadNotificationCount } from "@/lib/useUnreadNotificationCount";

// Separate component for header right to ensure proper re-rendering
const HeaderRight = ({
  unreadCount,
  isLoggingOut,
  onLogout,
  onNotificationsPress,
}: {
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
              {unreadCount > 100 ? "99+" : unreadCount.toString()}
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
  const unreadCount = useUnreadNotificationCount(!!user?.userId);
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    if (isLoggingOut) return;
    Alert.alert("Log Out", "Are you sure you want to log out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log Out",
        style: "destructive",
        onPress: async () => {
          try {
            setIsLoggingOut(true);
            await logout();
            // Always navigate to the root sign-in route (outside the protected (app) group).
            router.replace("/(root)/sign-in");
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  // Create headerRight function that will be recreated when unreadCount changes
  const headerRightCallback = useCallback(
    () => (
      <HeaderRight
        unreadCount={unreadCount}
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
        onNotificationsPress={() => router.push("/notifications")}
      />
    ),
    [unreadCount, isLoggingOut, router],
  );

  return (
    <Tabs
      screenOptions={{
        ...getModernTabBarOptions(insets),
        ...iosStackHeaderBackOptions,
        headerRight: headerRightCallback,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="home" color={color} size={focused ? size + 2 : size} />
          ),
        }}
      />

      <Tabs.Screen
        name="requests"
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="inbox" color={color} size={focused ? size + 2 : size} />
          ),
        }}
      />

      <Tabs.Screen
        name="wallet"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="credit-card" color={color} size={focused ? size + 2 : size} />
          ),
        }}
      />

      <Tabs.Screen
        name="issues"
        options={{
          title: "Issues",
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="book" color={color} size={focused ? size + 2 : size} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="user" color={color} size={focused ? size + 2 : size} />
          ),
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transaction History",
          href: null,
          headerLeft: () => <HeaderBackButton size={30} />,
          tabBarIcon: ({ color, size, focused }) => (
            <Feather name="credit-card" color={color} size={focused ? size + 2 : size} />
          ),
        }}
      />
      <Tabs.Screen
        name="teleconsultation-call"
        options={{
          href: null,
          headerShown: false,
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
