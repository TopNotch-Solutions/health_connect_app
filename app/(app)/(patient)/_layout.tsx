import { useAuth } from "@/context/AuthContext";
import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import React, { useState } from "react";
import { TouchableOpacity, View, StyleSheet } from "react-native";

export default function PatientTabLayout() {
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
          paddingTop: 6
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
          tabBarIcon: ({color, size}) => (
            <Feather name="home" color={color} size={size}/>
          )
        }}
      />
      <Tabs.Screen 
        name="waiting-room"
        options={{
          title: "Waiting Room",
          tabBarIcon: ({color, size}) => (
            <Feather name="clock" color={color} size={size}/>
          )
        }}
      />

      <Tabs.Screen
        name="transactions"
        options={{
          title: "Transactions",
          tabBarIcon: ({color, size}) => (
            <Feather name="credit-card" color={color} size={size}/>
          )
        }}
      />
      <Tabs.Screen
        name="issues"
        options={{
          title: "Issues",
          tabBarIcon: ({color, size}) => (
            <Feather name="book" color={color} size={size}/>
          )
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({color, size}) => (
            <Feather name="user" color={color} size={size}/>
          )
        }}
      />
      <Tabs.Screen
        name="all_ailments"
        options={{
          href: null,
          title: '',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }} accessibilityRole="button" accessibilityLabel="Go back">
              <Feather name="arrow-left" size={30} />
            </TouchableOpacity>
          ),
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
});