import { useAuth } from "@/context/AuthContext";
import {
  HeaderBackButton,
  iosStackHeaderBackOptions,
} from "@/components/HeaderBackButton";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  Tabs,
  useRouter,
} from "expo-router";
import React, { useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getModernTabBarOptions } from "@/lib/modernTabBar";
import { useUnreadNotificationCount } from "@/lib/useUnreadNotificationCount";

export default function PatientTabLayout() {
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
            router.replace("/sign-in");
          } finally {
            setIsLoggingOut(false);
          }
        },
      },
    ]);
  };

  // Memoize headerRight to ensure it re-renders when unreadCount changes
  const headerRight = useMemo(
    () => () => (
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
                  {unreadCount > 100 ? "99+" : unreadCount.toString()}
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
    [unreadCount, isLoggingOut, router],
  );

  return (
    <Tabs
      screenOptions={{
        ...getModernTabBarOptions(insets),
        ...iosStackHeaderBackOptions,
        headerRight,
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name="home"
              color={color}
              size={focused ? size + 2 : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="waiting-room"
        options={{
          title: "Waiting Room",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name="clock"
              color={color}
              size={focused ? size + 2 : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: "Issues",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name="book"
              color={color}
              size={focused ? size + 2 : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, size, focused }) => (
            <MaterialCommunityIcons
              name="account"
              color={color}
              size={focused ? size + 2 : size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="all_ailments"
        options={{
          href: null,
          title: "",
          headerLeft: () => <HeaderBackButton size={30} />,
        }}
      />
      <Tabs.Screen
        name="ailments"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="recent-activities"
        options={{
          href: null,
          title: "",
          headerLeft: () => <HeaderBackButton size={30} />,
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
});
