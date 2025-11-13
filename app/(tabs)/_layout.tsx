import { Feather } from "@expo/vector-icons";
import { Tabs, useRouter } from "expo-router";
import { Image, TouchableOpacity, View } from "react-native";


const HeaderLogo = () => (
  <Image
    source={require('../../assets/images/logo.jpeg')} // Make sure this path is correct
    style={{ 
      width: 180, // Adjust the width as needed
      height: 40,  // Adjust the height as needed
      resizeMode: 'contain',
    }}
  />
);

export default function TabsLayout(){
    const router = useRouter();

    return (
        <Tabs
            screenOptions={{
                headerTitle: () => <HeaderLogo />,
                 // --- 2. ADDED padding and height to the header style ---
                headerStyle: {
                    height: 90, // Give the header more vertical space
                },
                headerTitleContainerStyle: {
                    paddingLeft: 24, // Add padding to the left of the logo
                },
                tabBarShowLabel: true,
                tabBarStyle: { height: 64, paddingTop: 6},
                tabBarLabelStyle: {fontSize: 12, marginBottom: 6},
                headerRight: () => (
                    <View style={{ flexDirection: "row", gap: 16, marginRight: 12}}>
                        <TouchableOpacity onPress={() => router.push("/(tabs)/transactions")}>
                            <Feather name="credit-card" size={22}/>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => router.push("/notifications")}>
                            <Feather name="bell" size={22}/>
                        </TouchableOpacity>
                    </View>
                )
            }}
        >
            <Tabs.Screen
                name="home"
                options={{
                    title: "Home",
                    tabBarIcon: ({color, size}) => <Feather name="home" color={color} size={size}/>
                }}
            />
            <Tabs.Screen 
                name="waiting-room"
                options={{
                    title: "Waiting Room",
                    tabBarIcon: ({color, size}) => <Feather name="clock" color={color} size={size}/>
                }}
            />
            <Tabs.Screen
                name="transactions"
                options={{
                    title: "Transactions",
                    tabBarIcon: ({color, size}) => <Feather name="credit-card" color={color} size={size}/>
                }}
            />
            <Tabs.Screen
                name="issues"
                options={{
                    title: "Issues",
                    tabBarIcon: ({color, size}) => <Feather name="user" color={color} size={size}/>
                }}
            />
            <Tabs.Screen
                name="profile" 
            />
        </Tabs>
    )
}