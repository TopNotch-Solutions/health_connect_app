// app/(auth)/provider-type.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
type ProviderType = "doctor" | "nurse" | "physiotherapist" | "social worker";

const CARDS: Array<{
    type: ProviderType;
    title: string;
    icon: React.ComponentProps<typeof Feather>["name"];
    color: string;
    desc: string;
}> = [
    {
        type: "doctor",
        title: "Doctor",
        icon: "user-check",
        color: "#007BFF",
        desc: "Diagnose, prescribe & manage care.",
    },
    {
        type: "nurse",
        title: "Nurse",
        icon: "heart",
        color: "#28A745",
        desc: "Provide nursing care & follow-ups.",
    },
    { 
        type: "physiotherapist",
        title: "Physiotherapist",
        icon: "activity",
        color: "#6F42C1",
        desc: "Rehab, mobility plans & exercises.",
    },
    {
        type: "social worker",
        title: "Social Worker",
        icon: "users",
        color: "#17A2B8",
        desc: "Support services & case management.",
    },
];

export default function ProviderType() {
    const { cellphoneNumber = "" } = 
    useLocalSearchParams<{ cellphoneNumber?: string }>();

    const go = (t: ProviderType) =>
        router.push({
        pathname: "/(auth)/provder-registration",
        params: { cellphoneNumber, providerType: t },
    });

    return (
        <SafeAreaView className="flex-1 bg-background-light">
            <View className="flex-1 justify-center p-6">
                <View className="mb-6">
                    <Text className="text-3xl font-bold text-text-main">
                        Select provider type
                    </Text>
                    <Text className="text-gray-500">
                        Verified: {cellphoneNumber}
                    </Text>
                </View>

                <View>
                    {CARDS.map((c)=> (
                        <TouchableOpacity
                            key={c.type}
                            className="w-full bg-white p-6 rounded-xl border border-gray-200 flex-row items-center mb-4"
                            onPress={()=> go(c.type)}
                            activeOpacity={0.85}
                        >
                            <Feather name={c.icon} size={30} color={c.color}/>
                            <View className="ml-5">
                                <Text>
                                    {c.title}
                                </Text>
                                <Text>{c.desc}</Text>
                            </View>
                        </TouchableOpacity>
                    ) )}
                </View>
            </View>
        </SafeAreaView>
    );
}
