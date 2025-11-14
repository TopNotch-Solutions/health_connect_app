import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View } from "react-native";

export default function ProviderTabsLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        tabBarShowLabel: true,
        tabBarStyle: { height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, marginBottom: 6 },
        headerRight: () => (
          <View style={{ flexDirection: "row", gap: 16, marginRight: 16 }}>
            <TouchableOpacity onPress={() => router.push("/wallet")}>
              <Feather name="credit-card" size={22} />
            </TouchableOpacity>
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
      <Tabs.Screen
        name="map"
        options={{
          title: "Map",
          tabBarIcon: ({color, size}) => (
            <Feather name="map" color={color} size={size}/>
          )
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
    </Tabs>
  );
}
