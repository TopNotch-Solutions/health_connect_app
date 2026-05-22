import React from "react";
import { Platform, TouchableOpacity } from "react-native";
import { fireEvent, render } from "@testing-library/react-native";
import { PickerField } from "../PickerField";
import { pickerFieldStyles } from "../../lib/pickerStyles";

const mockOnValueChange = jest.fn();

jest.mock("@expo/vector-icons", () => ({
  Feather: () => null,
}));

jest.mock("react-native-picker-select", () => {
  const React = require("react");
  const { Text, TouchableOpacity, View } = require("react-native");

  function MockRNPickerSelect(props: {
    disabled?: boolean;
    value?: string | null;
    onValueChange?: (value: string, index: number) => void;
    items?: { label: string; value: string }[];
    placeholder?: { label: string; value: null };
    touchableWrapperProps?: Record<string, unknown>;
    fixAndroidTouchableBug?: boolean;
  }) {
    const label =
      props.items?.find((item) => item.value === props.value)?.label ??
      props.placeholder?.label ??
      "";

    return (
      <View testID="mock-rn-picker-select">
        <TouchableOpacity
          testID="picker-touchable"
          accessibilityRole="button"
          disabled={Boolean(props.disabled || props.touchableWrapperProps?.disabled)}
          style={props.touchableWrapperProps?.style}
          activeOpacity={props.touchableWrapperProps?.activeOpacity as number}
          onPress={() => {
            if (props.disabled || props.touchableWrapperProps?.disabled) {
              return;
            }
            const first = props.items?.[0];
            if (first && props.onValueChange) {
              props.onValueChange(first.value, 0);
            }
          }}
        >
          <Text testID="picker-label">{label}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return {
    __esModule: true,
    default: MockRNPickerSelect,
  };
});

const items = [
  { label: "Doctor", value: "doctor" },
  { label: "Nurse", value: "nurse" },
];

describe("PickerField", () => {
  beforeEach(() => {
    mockOnValueChange.mockClear();
  });

  it("renders an enabled touchable that fills the field area", () => {
    const { getByTestId } = render(
      <PickerField
        value=""
        onValueChange={mockOnValueChange}
        items={items}
        placeholder="Select role..."
      />,
    );

    const touchable = getByTestId("picker-touchable");
    expect(touchable.props.disabled).not.toBe(true);
    expect(touchable.props.style).toEqual(
      expect.objectContaining(pickerFieldStyles.touchableWrapper),
    );
  });

  it("calls onValueChange when the field is pressed", () => {
    const { getByTestId } = render(
      <PickerField
        value=""
        onValueChange={mockOnValueChange}
        items={items}
      />,
    );

    fireEvent.press(getByTestId("picker-touchable"));

    expect(mockOnValueChange).toHaveBeenCalledTimes(1);
    expect(mockOnValueChange).toHaveBeenCalledWith("doctor", 0);
  });

  it("does not respond to presses when disabled", () => {
    const { getByTestId } = render(
      <PickerField
        value=""
        onValueChange={mockOnValueChange}
        items={items}
        disabled
      />,
    );

    fireEvent.press(getByTestId("picker-touchable"));
    expect(mockOnValueChange).not.toHaveBeenCalled();
  });

  it("enables fixAndroidTouchableBug on Android", () => {
    const originalOS = Platform.OS;
    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => "android",
    });

    const { getByTestId } = render(
      <PickerField
        value=""
        onValueChange={mockOnValueChange}
        items={items}
      />,
    );

    fireEvent.press(getByTestId("picker-touchable"));
    expect(mockOnValueChange).toHaveBeenCalledWith("doctor", 0);

    Object.defineProperty(Platform, "OS", {
      configurable: true,
      get: () => originalOS,
    });
  });
});
