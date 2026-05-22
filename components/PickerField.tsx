import { Feather } from "@expo/vector-icons";
import React, { useCallback, useRef } from "react";
import { Platform, Pressable, View } from "react-native";
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

type PickerSelectHandle = {
  togglePicker: (animate?: boolean) => void;
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
  const pickerRef = useRef<PickerSelectHandle | null>(null);

  const openPicker = useCallback(() => {
    if (disabled) return;
    pickerRef.current?.togglePicker(true);
  }, [disabled]);

  const containerStyle = getPickerContainerStyle({
    height,
    borderColor,
    backgroundColor,
    error,
    disabled,
  });

  return (
    <View style={containerStyle} collapsable={false}>
      <Pressable
        onPress={openPicker}
        disabled={disabled}
        style={pickerFieldStyles.pressableOverlay}
        accessibilityRole="button"
        accessibilityState={{ disabled }}
      >
        <RNPickerSelect
          ref={pickerRef as React.RefObject<RNPickerSelect>}
          disabled={disabled}
          value={value ?? null}
          onValueChange={(val, index) =>
            onValueChange(val != null ? String(val) : "", index)
          }
          items={items}
          placeholder={{ label: placeholder, value: null }}
          useNativeAndroidPickerStyle={false}
          fixAndroidTouchableBug={Platform.OS === "android"}
          onOpen={openPicker}
          style={pickerSelectStyles}
          touchableWrapperProps={{
            style: pickerFieldStyles.touchableWrapper,
            activeOpacity: 1,
            ...(Platform.OS === "ios"
              ? { disabled: true, pointerEvents: "none" as const }
              : {}),
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
      </Pressable>
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
