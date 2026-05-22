import { Feather } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import {
  Platform,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

const IS_IOS = Platform.OS === "ios";

export const IOS_BACK_ICON_SIZE = IS_IOS ? 28 : 24;

/** React Navigation header left slot — pins back control to the leading edge on iOS */
export const iosHeaderLeftContainerStyle: ViewStyle | undefined = IS_IOS
  ? {
      paddingLeft: 4,
      marginLeft: 0,
      alignItems: "flex-start",
      justifyContent: "center",
    }
  : undefined;

/** Stack / tab screen options — left-aligned titles and back button on iOS */
export const iosStackHeaderBackOptions = IS_IOS
  ? {
      headerBackButtonDisplayMode: "minimal" as const,
      headerLeftContainerStyle: iosHeaderLeftContainerStyle,
      headerTitleAlign: "left" as const,
      headerTitleContainerStyle: {
        alignItems: "flex-start" as const,
        justifyContent: "center" as const,
      },
    }
  : {};

/** Custom in-screen top bar container (notifications, ailments, terms, etc.) */
export const iosCustomTopBarStyle: ViewStyle | undefined = IS_IOS
  ? { paddingLeft: 12, paddingRight: 16 }
  : undefined;

/** Row wrapping back button + title in custom headers */
export const iosCustomTopBarRowStyle: ViewStyle | undefined = IS_IOS
  ? { alignItems: "center", justifyContent: "flex-start", width: "100%" }
  : undefined;

type HeaderBackButtonProps = {
  onPress?: () => void;
  color?: string;
  size?: number;
};

export function HeaderBackButton({
  onPress,
  color = "#111827",
  size = IOS_BACK_ICON_SIZE,
}: HeaderBackButtonProps) {
  const router = useRouter();

  return (
    <TouchableOpacity
      onPress={onPress ?? (() => router.back())}
      style={styles.button}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
    >
      <Feather name="arrow-left" size={size} color={color} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: Platform.select({
    ios: {
      paddingLeft: 0,
      paddingRight: 8,
      paddingVertical: 4,
      marginLeft: -2,
      alignSelf: "flex-start",
    },
    default: {
      padding: 8,
    },
  }) as ViewStyle,
});
