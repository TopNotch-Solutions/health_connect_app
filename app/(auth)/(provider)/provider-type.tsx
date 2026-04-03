// app/(auth)/provider-type.tsx
import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
type ProviderType =
  | "doctor"
  | "nurse"
  | "physiotherapist"
  | "social worker"
  | "pharmacist";

const CARDS: {
  type: ProviderType;
  title: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  color: string;
  bgColor: string;
  desc: string;
}[] = [
  {
    type: "doctor",
    title: "Doctor",
    icon: "user-check",
    color: "#3B82F6",
    bgColor: "#DBEAFE",
    desc: "Diagnose, prescribe & manage care.",
  },
  {
    type: "nurse",
    title: "Nurse",
    icon: "heart",
    color: "#EF4444",
    bgColor: "#FEE2E2",
    desc: "Provide nursing care & follow-ups.",
  },
  {
    type: "physiotherapist",
    title: "Physiotherapist",
    icon: "activity",
    color: "#10B981",
    bgColor: "#D1FAE5",
    desc: "Rehab, mobility plans & exercises.",
  },
  {
    type: "social worker",
    title: "Social Worker",
    icon: "users",
    color: "#8B5CF6",
    bgColor: "#EDE9FE",
    desc: "Support services & case management.",
  },
  {
    type: "pharmacist",
    title: "Pharmacist",
    icon: "clipboard",
    color: "#F59E0B",
    bgColor: "#FEF3C7",
    desc: "Dispense medicines & support safe use.",
  },
];

export default function ProviderTypeScreen() {
  const { cellphoneNumber = "" } = useLocalSearchParams<{
    cellphoneNumber?: string;
  }>();

  const go = (t: ProviderType) =>
    router.push({
      pathname: "/(auth)/(provider)/provder-registration",
      params: { cellphoneNumber, providerType: t },
    });

  return (
    <SafeAreaView className="flex-1 bg-gradient-to-b from-blue-50 to-white">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 px-6 justify-center py-6">
          {/* Logo Section */}
          <View className="items-center mb-6">
            {/* <Image
              source={require("../../../assets/images/healthconnectlogo-cropped.png")}
              style={{ width: 120, height: 120, backgroundColor: "red" }}
              resizeMode="contain"
            /> */}
            <Text className="text-3xl font-bold text-gray-900 text-center mb-2">
              Select Your Specialty
            </Text>
            <Text className="text-base text-gray-600 text-center px-4">
              Choose your medical profession
            </Text>
          </View>

          {/* Provider Type Cards - 2-column grid */}
          <View style={{ gap: 16 }}>
            {Array.from({ length: Math.ceil(CARDS.length / 2) }).map((_, r) => {
              const row = CARDS.slice(r * 2, r * 2 + 2);
              return (
                <View key={r} className="flex-row" style={{ gap: 16 }}>
                  {row.map((c) => (
                    <TouchableOpacity
                      key={c.type}
                      className="flex-1 bg-white p-4 rounded-3xl border-2 border-gray-200 items-center"
                      style={{
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 6 },
                        shadowOpacity: 0.25,
                        shadowRadius: 12,
                        elevation: 8,
                      }}
                      onPress={() => go(c.type)}
                      activeOpacity={0.7}
                    >
                      <View
                        className="w-16 h-16 rounded-full items-center justify-center mb-3"
                        style={{ backgroundColor: c.bgColor }}
                      >
                        <Feather name={c.icon} size={30} color={c.color} />
                      </View>
                      <Text className="text-lg font-bold text-gray-900 mb-1 text-center">
                        {c.title}
                      </Text>
                      <Text className="text-sm text-gray-700 text-center font-medium">
                        {c.desc}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  {row.length === 1 && <View className="flex-1" />}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
