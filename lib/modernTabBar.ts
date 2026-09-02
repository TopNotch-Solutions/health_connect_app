import { Platform } from "react-native";
import type { BottomTabNavigationOptions } from "@react-navigation/bottom-tabs";

/** Primary bottom tab bar background */
export const TAB_BAR_BG = "#03a9fc";

export function getModernTabBarOptions(
  insets: { bottom: number },
): Pick<
  BottomTabNavigationOptions,
  | "tabBarShowLabel"
  | "tabBarActiveTintColor"
  | "tabBarInactiveTintColor"
  | "tabBarStyle"
  | "tabBarLabelStyle"
  | "tabBarItemStyle"
  | "tabBarHideOnKeyboard"
> {
  const bottomPad = Math.max(insets.bottom, 10);

  return {
    tabBarShowLabel: true,
    tabBarHideOnKeyboard: true,
    tabBarActiveTintColor: "#FFFFFF",
    tabBarInactiveTintColor: "rgba(255, 255, 255, 0.58)",
    tabBarStyle: {
      backgroundColor: TAB_BAR_BG,
      borderTopWidth: 0,
      height: 58 + bottomPad,
      paddingTop: 6,
      paddingBottom: bottomPad,
      paddingHorizontal: 8,
      ...Platform.select({
        ios: {
          shadowColor: "#01579B",
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
        },
        android: {
          elevation: 20,
        },
        default: {},
      }),
    },
    tabBarLabelStyle: {
      fontSize: 11,
      fontWeight: "700",
      letterSpacing: 0.2,
      marginTop: 2,
    },
    tabBarItemStyle: {
      paddingTop: 2,
    },
  };
}
