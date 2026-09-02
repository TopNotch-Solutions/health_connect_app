import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import AuthScreenLayout from "../../components/AuthScreenLayout";
import { AuthTopBackButton } from "../../components/AuthTopBackButton";
import ScreenLayout from "../../components/ScreenLayout";
import { AUTH_COLORS, authScreenStyles } from "../../lib/authScreenTheme";

const STORAGE_KEY = "hasSeenOnboarding";

const OPTIONS = [
  {
    role: "patient" as const,
    title: "Patient",
    icon: "heart" as const,
    desc: "Access healthcare services and manage your wellness journey.",
  },
  {
    role: "provider" as const,
    title: "Health Provider",
    icon: "user-check" as const,
    desc: "Provide care and connect with patients in your community.",
  },
];

const SelectionScreen = () => {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: "signup" | "onboarding" }>();
  const isSignupMode = mode === "signup";
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (isSignupMode) {
      setChecking(false);
      return;
    }
    setChecking(false);
  }, [isSignupMode]);

  const handleSelection = async (role: "patient" | "provider") => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // ignore storage errors
    }

    router.push({
      pathname: "/(verification)/verify-phone",
      params: { role },
    });
  };

  if (checking) {
    return (
      <ScreenLayout
        backgroundColor={AUTH_COLORS.bg}
        style={styles.loadingWrap}
      >
        <ActivityIndicator size="large" color={AUTH_COLORS.green} />
      </ScreenLayout>
    );
  }

  return (
    <View style={styles.screen}>
      <AuthScreenLayout
        extraScrollTopPadding={isSignupMode ? 56 : 0}
        scrollBottomPadding={24}
      >
        <Text style={authScreenStyles.sectionTitle}>
          Choose your account type
        </Text>

        <View style={styles.cardList}>
          {OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.role}
              style={styles.card}
              onPress={() => handleSelection(option.role)}
              activeOpacity={0.85}
            >
              <View style={styles.cardHeader}>
                <View style={styles.iconCircle}>
                  <Feather
                    name={option.icon}
                    size={28}
                    color={AUTH_COLORS.green}
                  />
                </View>
                <View style={styles.cardArrow}>
                  <Feather
                    name="arrow-right"
                    size={16}
                    color={AUTH_COLORS.green}
                  />
                </View>
              </View>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDesc}>{option.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </AuthScreenLayout>

      {isSignupMode ? (
        <AuthTopBackButton accessibilityLabel="Back to Sign In" />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  cardList: {
    gap: 14,
  },
  card: {
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    padding: 20,
    shadowColor: AUTH_COLORS.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: AUTH_COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  cardArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(187, 247, 208, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
    fontWeight: "500",
  },
});

export default SelectionScreen;
