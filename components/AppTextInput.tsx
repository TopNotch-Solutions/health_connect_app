import React from "react";
import { TextInput, TextInputProps } from "react-native";
import { INPUT_PLACEHOLDER_COLOR } from "../lib/inputStyles";

export function AppTextInput({
  placeholderTextColor = INPUT_PLACEHOLDER_COLOR,
  ...rest
}: TextInputProps) {
  return <TextInput placeholderTextColor={placeholderTextColor} {...rest} />;
}

export { INPUT_PLACEHOLDER_COLOR };
