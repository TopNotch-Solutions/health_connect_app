import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { Edge, SafeAreaView } from "react-native-safe-area-context";

/** Full screen — standalone routes without a stack header */
export const SCREEN_EDGES_FULL: Edge[] = ["top", "bottom", "left", "right"];

/** Tab stack push screens that already have a native header */
export const SCREEN_EDGES_STACK: Edge[] = ["bottom", "left", "right"];

/** Modal / partial safe area at top only */
export const SCREEN_EDGES_TOP: Edge[] = ["top"];

export const KEYBOARD_VERTICAL_OFFSET = Platform.OS === "ios" ? 88 : 0;

export const KEYBOARD_AWARE_EXTRA_SCROLL = 150;

export type ScreenLayoutProps = {
  children: React.ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  /** Standard KeyboardAvoidingView — use with FlatList or fixed headers */
  keyboard?: boolean;
  /** KeyboardAwareScrollView — best for long forms */
  keyboardAwareScroll?: boolean;
  keyboardAwareContentContainerStyle?: StyleProp<ViewStyle>;
  scroll?: boolean;
  scrollContentContainerStyle?: StyleProp<ViewStyle>;
  keyboardShouldPersistTaps?: "handled" | "always" | "never";
};

export function ScreenLayout({
  children,
  edges = SCREEN_EDGES_FULL,
  style,
  backgroundColor = "#FFFFFF",
  keyboard = false,
  keyboardAwareScroll = false,
  keyboardAwareContentContainerStyle,
  scroll = false,
  scrollContentContainerStyle,
  keyboardShouldPersistTaps = "handled",
}: ScreenLayoutProps) {
  const screenStyle: StyleProp<ViewStyle> = [{ flex: 1, backgroundColor }, style];

  const renderContent = () => {
    if (keyboardAwareScroll) {
      return (
        <KeyboardAwareScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.flexGrow,
            keyboardAwareContentContainerStyle,
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          enableOnAndroid
          enableAutomaticScroll
          extraScrollHeight={KEYBOARD_AWARE_EXTRA_SCROLL}
        >
          {children}
        </KeyboardAwareScrollView>
      );
    }

    if (keyboard) {
      const body = scroll ? (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[styles.flexGrow, scrollContentContainerStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        children
      );

      return (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
        >
          {body}
        </KeyboardAvoidingView>
      );
    }

    if (scroll) {
      return (
        <ScrollView
          style={styles.flex}
          contentContainerStyle={scrollContentContainerStyle}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      );
    }

    return <View style={styles.flex}>{children}</View>;
  };

  return (
    <SafeAreaView style={screenStyle} edges={edges}>
      {renderContent()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexGrow: { flexGrow: 1 },
});

export default ScreenLayout;
