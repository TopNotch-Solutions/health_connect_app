import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View } from "react-native";

export default function ProviderTabsLayout() {
  const router = useRouter();

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
          marginBottom: 6 
        },
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 16, marginRight: 16 }}>
            <TouchableOpacity onPress={() => router.push("/notifications")}>
              <Feather name="bell" size={22} />
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

      {/* Map tab changed to Requests */}
      <Tabs.Screen
        name="requests" // make sure you have app/(provider)/req.tsx (or a folder named req/)
        options={{
          title: "Requests",
          tabBarIcon: ({ color, size }) => (
            <Feather name="inbox" color={color} size={size} />
          ),
        }}
      />

      {/* Profile tab now shown as Wallet with a wallet-like icon */}
      <Tabs.Screen
        name="profile" // keep this if your file is profile.tsx
        options={{
          title: "Wallet",
          tabBarIcon: ({ color, size }) => (
            <Feather name="credit-card" color={color} size={size} />
          ),
        }}
      />

      {/* Settings already uses a settings icon */}
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Feather name="settings" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
