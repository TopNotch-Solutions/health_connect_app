import React, { forwardRef } from "react";
import { TextInput, TextInputProps } from "react-native";
import { INPUT_PLACEHOLDER_COLOR } from "../lib/inputStyles";

export const AppTextInput = forwardRef<TextInput, TextInputProps>(
  function AppTextInput(
    { placeholderTextColor = INPUT_PLACEHOLDER_COLOR, ...rest },
    ref,
  ) {
    return (
      <TextInput
        ref={ref}
        placeholderTextColor={placeholderTextColor}
        {...rest}
      />
    );
  },
);

export { INPUT_PLACEHOLDER_COLOR };
