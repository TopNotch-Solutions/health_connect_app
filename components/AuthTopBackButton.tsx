import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  StyleProp,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { authScreenStyles } from "../lib/authScreenTheme";

type AuthTopBackButtonProps = {
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function AuthTopBackButton({
  onPress,
  style,
  accessibilityLabel = "Go back",
}: AuthTopBackButtonProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <TouchableOpacity
      onPress={onPress ?? (() => router.back())}
      style={[
        authScreenStyles.topBackButton,
        { top: insets.top + 8, left: 28 },
        style,
      ]}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Feather name="arrow-left" size={22} color="#FFFFFF" />
    </TouchableOpacity>
  );
}

export default AuthTopBackButton;
