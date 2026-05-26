import { DimensionValue, Platform, StyleSheet, ViewStyle } from "react-native";
import type { PickerStyle } from "react-native-picker-select";
import { INPUT_PLACEHOLDER_COLOR } from "./inputStyles";

const STRETCH_WIDTH = "100%" as DimensionValue;

/** Shared RNPickerSelect styles — iOS touch target must fill the container */
export const pickerSelectStyles = {
  inputIOS: {
    fontSize: 17,
    lineHeight: 22,
    paddingVertical: Platform.OS === "ios" ? 14 : 12,
    paddingHorizontal: 12,
    paddingRight: 36,
    color: "#111827",
    width: STRETCH_WIDTH,
  },
  inputAndroid: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    paddingRight: 36,
    color: "#111827",
  },
  viewContainer: {
    flex: 1,
    justifyContent: "center",
    alignSelf: "stretch",
    width: STRETCH_WIDTH,
    height: STRETCH_WIDTH,
  },
  inputIOSContainer: {
    width: STRETCH_WIDTH,
    alignSelf: "stretch",
  },
  inputAndroidContainer: {
    width: STRETCH_WIDTH,
    alignSelf: "stretch",
  },
  headlessAndroidContainer: {
    width: STRETCH_WIDTH,
    alignSelf: "stretch",
  },
  placeholder: {
    color: INPUT_PLACEHOLDER_COLOR,
  },
  iconContainer: {
    display: "none" as const,
  },
  chevronContainer: {
    display: "none" as const,
  },
  chevron: {
    display: "none" as const,
  },
  modalViewMiddle: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  modalViewBottom: {
    backgroundColor: "#FFFFFF",
  },
} as PickerStyle;

export const pickerFieldStyles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 4,
    overflow: "visible",
    zIndex: 1,
  },
  pickerWrapper: {
    flex: 1,
    alignSelf: "stretch",
    width: "100%",
  },
  touchableWrapper: {
    flex: 1,
    width: "100%",
    alignSelf: "stretch",
    justifyContent: "center",
    minHeight: "100%",
  },
  iconOverlay: {
    position: "absolute",
    right: 14,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    pointerEvents: "none",
  },
  disabled: {
    opacity: 0.6,
    backgroundColor: "#F9FAFB",
  },
});

export type PickerFieldContainerOptions = {
  height?: number;
  borderColor?: string;
  backgroundColor?: string;
  error?: boolean;
  disabled?: boolean;
};

export function getPickerContainerStyle({
  height = Platform.OS === "ios" ? 56 : 52,
  borderColor = "#D1D5DB",
  backgroundColor = "#FFFFFF",
  error = false,
  disabled = false,
}: PickerFieldContainerOptions = {}): ViewStyle {
  return StyleSheet.flatten([
    pickerFieldStyles.container,
    {
      height,
      borderColor: error ? "#EF4444" : borderColor,
      backgroundColor,
    },
    disabled ? pickerFieldStyles.disabled : null,
  ]);
}
