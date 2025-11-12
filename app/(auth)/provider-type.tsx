// app/(auth)/provider-type.tsx
import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "react-native";
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
        color: "#007BFF",
        desc: "Provide nursing care & follow-ups.",
    },
    { 
        type: "physiotherapist",
        title: "Physiotherapist",
        icon: "activity",
        color: "#007BFF",
        desc: "Rehab, mobility plans & exercises.",
    },
    {
        type: "social worker",
        title: "Social Worker",
        icon: "users",
        color: "#007BFF",
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
        <SafeAreaView className="flex-1">
            <View className="items-center">
                <Image
                    source={require('../../assets/images/healthconnectlogo.png')} 
                    className="w-40 h-40"
                    resizeMode="contain"
                />
            </View>

            <View className="flex-1 p-6">
                <View className="mt-3 mb-4">
                    <Text className="text-3xl font-bold">
                        Select Specialty
                    </Text>
                    <Text className="text-base text-gray-600">
                        Please select your medical profession
                    </Text>
                    <Text className="">
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
