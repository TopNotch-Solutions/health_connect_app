import React, { forwardRef } from "react";
import { TextInput, type TextInputProps } from "react-native";
import { INPUT_PLACEHOLDER_COLOR } from "../lib/inputStyles";

type TextInputRef = React.ComponentRef<typeof TextInput>;

export const AppTextInput = forwardRef<TextInputRef, TextInputProps>(
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
