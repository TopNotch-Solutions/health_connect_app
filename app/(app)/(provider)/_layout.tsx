import { useAuth } from "@/context/AuthContext";
import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View, Text, StyleSheet } from "react-native";
import React, { useState } from "react";

export default function ProviderTabsLayout() {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

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
          height: 64,
          paddingTop: 6,
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
              <Feather name="bell" size={22} />
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