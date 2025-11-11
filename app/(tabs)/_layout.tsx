import { Feather } from "@expo/vector-icons";
import { HeaderTitle } from "@react-navigation/elements";
import { Tabs, useRouter } from "expo-router";
import { TouchableOpacity, View } from "react-native";

export default function TabsLayout(){
    const router = useRouter();

    return (
        <Tabs
            screenOptions={{
                headerTitle: "Health Connect",
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