import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import RNPickerSelect, { Item } from "react-native-picker-select";
import {
  getPickerContainerStyle,
  pickerFieldStyles,
  pickerSelectStyles,
} from "../lib/pickerStyles";

export type PickerFieldProps = {
  value: string | null | undefined;
  onValueChange: (value: string, index?: number) => void;
  items: Item[];
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
  borderColor?: string;
  backgroundColor?: string;
  height?: number;
};

const iosPickerStyles = {
  ...pickerSelectStyles,
  viewContainer: {
    ...pickerSelectStyles.viewContainer,
    flex: 1,
    width: "100%" as const,
    alignSelf: "stretch" as const,
  },
  inputIOSContainer: {
    ...pickerSelectStyles.inputIOSContainer,
    width: "100%" as const,
    alignSelf: "stretch" as const,
  },
  inputIOS: {
    ...pickerSelectStyles.inputIOS,
    width: "100%" as const,
  },
};

export function PickerField({
  value,
  onValueChange,
  items,
  placeholder = "Select...",
  disabled = false,
  error = false,
  borderColor,
  backgroundColor,
  height,
}: PickerFieldProps) {
  const fieldHeight = height ?? (Platform.OS === "ios" ? 56 : 52);

  const platformStyles =
    Platform.OS === "ios"
      ? {
          ...iosPickerStyles,
          inputIOS: {
            ...iosPickerStyles.inputIOS,
            height: fieldHeight,
            paddingVertical: 0,
          },
          viewContainer: {
            ...iosPickerStyles.viewContainer,
            height: fieldHeight,
            justifyContent: "center" as const,
          },
        }
      : pickerSelectStyles;

  return (
    <View
      style={getPickerContainerStyle({
        height: fieldHeight,
        borderColor,
        backgroundColor,
        error,
        disabled,
      })}
      collapsable={false}
    >
      <View
        style={[styles.fieldBody, { height: fieldHeight }]}
        collapsable={false}
      >
        <RNPickerSelect
          disabled={disabled}
          value={value ?? null}
          onValueChange={(val: string | null, index?: number) =>
            onValueChange(val != null ? String(val) : "", index)
          }
          items={items}
          placeholder={{ label: placeholder, value: null }}
          useNativeAndroidPickerStyle={false}
          fixAndroidTouchableBug={Platform.OS === "android"}
          style={platformStyles}
          touchableWrapperProps={{
            style: pickerFieldStyles.touchableWrapper,
            activeOpacity: 0.65,
            disabled,
          }}
          textInputProps={
            Platform.OS === "ios" ? { pointerEvents: "none" } : undefined
          }
          doneText="Done"
          Icon={() => null}
          pickerProps={
            Platform.OS === "ios"
              ? { itemStyle: { fontSize: 17, color: "#111827" } }
              : undefined
          }
        />
      </View>

      <View style={pickerFieldStyles.iconOverlay} pointerEvents="none">
        <Feather
          name="chevron-down"
          size={20}
          color={disabled ? "#D1D5DB" : "#374151"}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldBody: {
    flex: 1,
    width: "100%",
  },
});

export { pickerSelectStyles };
