import { Feather } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import AuthScreenLayout from "../../../components/AuthScreenLayout";
import { AUTH_COLORS, authScreenStyles } from "../../../lib/authScreenTheme";

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
  desc: string;
}[] = [
  {
    type: "doctor",
    title: "Doctor",
    icon: "user-check",
    desc: "Diagnose, prescribe & manage care.",
  },
  {
    type: "nurse",
    title: "Nurse",
    icon: "heart",
    desc: "Provide nursing care & follow-ups.",
  },
  {
    type: "physiotherapist",
    title: "Physiotherapist",
    icon: "activity",
    desc: "Rehab, mobility plans & exercises.",
  },
  {
    type: "social worker",
    title: "Social Worker",
    icon: "users",
    desc: "Support services & case management.",
  },
  {
    type: "pharmacist",
    title: "Pharmacist",
    icon: "clipboard",
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
    <AuthScreenLayout
      greeting="Hello there!"
      greetingSub="Select your specialty."
      scrollBottomPadding={24}
    >
      <Text style={authScreenStyles.sectionTitle}>Choose your profession</Text>

      <View style={styles.grid}>
        {Array.from({ length: Math.ceil(CARDS.length / 2) }).map((_, rowIndex) => {
          const row = CARDS.slice(rowIndex * 2, rowIndex * 2 + 2);
          return (
            <View key={rowIndex} style={styles.row}>
              {row.map((card) => (
                <TouchableOpacity
                  key={card.type}
                  style={styles.card}
                  onPress={() => go(card.type)}
                  activeOpacity={0.85}
                >
                  <View style={styles.iconCircle}>
                    <Feather name={card.icon} size={28} color={AUTH_COLORS.green} />
                  </View>
                  <Text style={styles.cardTitle}>{card.title}</Text>
                  <Text style={styles.cardDesc}>{card.desc}</Text>
                  <View style={styles.cardArrow}>
                    <Feather
                      name="arrow-right"
                      size={16}
                      color={AUTH_COLORS.green}
                    />
                  </View>
                </TouchableOpacity>
              ))}
              {row.length === 1 ? <View style={styles.cardSpacer} /> : null}
            </View>
          );
        })}
      </View>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  grid: {
    gap: 14,
  },
  row: {
    flexDirection: "row",
    gap: 14,
  },
  card: {
    flex: 1,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 16,
    alignItems: "center",
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardSpacer: {
    flex: 1,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    textAlign: "center",
    marginBottom: 4,
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
    fontWeight: "500",
  },
  cardArrow: {
    marginTop: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(187, 247, 208, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
