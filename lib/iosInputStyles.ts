import { Platform, StyleProp, TextStyle, ViewStyle } from "react-native";

export { INPUT_PLACEHOLDER_COLOR } from "./inputStyles";

const IS_IOS = Platform.OS === "ios";

/** Icon size beside inputs in flex-row containers */
export const iosInputIconSize = IS_IOS ? 22 : 20;

const nestedTextInputStyle: TextStyle = {
  fontSize: 17,
  lineHeight: 22,
  minHeight: 24,
  paddingVertical: 2,
};

const inputContainerStyle: ViewStyle = {
  paddingVertical: 16,
  minHeight: 56,
};

const standaloneTextInputStyle: TextStyle = {
  fontSize: 17,
  lineHeight: 22,
  paddingVertical: 16,
  minHeight: 56,
};

const multilineTextInputStyle: TextStyle = {
  fontSize: 17,
  lineHeight: 22,
  paddingVertical: 12,
  minHeight: 120,
};

const otpTextInputStyle: TextStyle = {
  fontSize: 24,
  lineHeight: 28,
  minHeight: 64,
  minWidth: 56,
};

/** TextInput inside a bordered flex-row container (e.g. sign-in, search bars) */
export function withIosTextInputStyle(
  style?: StyleProp<TextStyle>,
): StyleProp<TextStyle> {
  if (!IS_IOS) return style;
  return style ? [style, nestedTextInputStyle] : nestedTextInputStyle;
}

/** Wrapper View around icon + TextInput */
export function withIosInputContainerStyle(
  style?: StyleProp<ViewStyle>,
): StyleProp<ViewStyle> {
  if (!IS_IOS) return style;
  return style ? [style, inputContainerStyle] : inputContainerStyle;
}

/** TextInput that includes its own border/padding (className or StyleSheet) */
export function withIosStandaloneTextInputStyle(
  style?: StyleProp<TextStyle>,
): StyleProp<TextStyle> {
  if (!IS_IOS) return style;
  return style ? [style, standaloneTextInputStyle] : standaloneTextInputStyle;
}

/** Multiline description / bio fields */
export function withIosMultilineTextInputStyle(
  style?: StyleProp<TextStyle>,
): StyleProp<TextStyle> {
  if (!IS_IOS) return style;
  return style ? [style, multilineTextInputStyle] : multilineTextInputStyle;
}

/** OTP digit boxes */
export function withIosOtpTextInputStyle(
  style?: StyleProp<TextStyle>,
): StyleProp<TextStyle> {
  if (!IS_IOS) return style;
  return style ? [style, otpTextInputStyle] : otpTextInputStyle;
}

const passwordTogglePadding: TextStyle = {
  paddingRight: IS_IOS ? 48 : 40,
};

/** Standalone bordered fields with a trailing visibility toggle (registration passwords) */
export function withIosStandalonePasswordTextInputStyle(
  style?: StyleProp<TextStyle>,
): StyleProp<TextStyle> {
  const base = withIosStandaloneTextInputStyle();
  return style ? [base, passwordTogglePadding, style] : [base, passwordTogglePadding];
}

/** Positions the eye icon vertically centered on standalone password fields */
export const iosPasswordToggleButtonStyle: ViewStyle = {
  position: "absolute",
  right: 16,
  top: 0,
  bottom: 0,
  justifyContent: "center",
  alignItems: "center",
  width: 32,
};
