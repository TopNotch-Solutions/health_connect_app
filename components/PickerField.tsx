import { Feather } from "@expo/vector-icons";
import React from "react";
import { Platform, View } from "react-native";
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
  return (
    <View
      style={getPickerContainerStyle({
        height,
        borderColor,
        backgroundColor,
        error,
        disabled,
      })}
      collapsable={false}
    >
      <RNPickerSelect
        disabled={disabled}
        value={value ?? null}
        onValueChange={(val, index) =>
          onValueChange(val != null ? String(val) : "", index)
        }
        items={items}
        placeholder={{ label: placeholder, value: null }}
        useNativeAndroidPickerStyle={false}
        style={pickerSelectStyles}
        touchableWrapperProps={{
          style: pickerFieldStyles.touchableWrapper,
          activeOpacity: 0.65,
          disabled,
          ...(Platform.OS === "ios"
            ? { hitSlop: { top: 8, bottom: 8, left: 4, right: 4 } }
            : {}),
        }}
        doneText="Done"
        Icon={() => null}
        pickerProps={
          Platform.OS === "ios"
            ? { itemStyle: { fontSize: 17, color: "#111827" } }
            : undefined
        }
      />
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

export { pickerSelectStyles };
