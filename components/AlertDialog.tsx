import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AUTH_COLORS } from "../lib/authScreenTheme";

export type AlertDialogButton = {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void | Promise<void>;
};

export type AlertDialogOptions = {
  /** Tapping the backdrop / Android back dismisses (runs the cancel button). */
  cancelable?: boolean;
};

type AlertDialogRequest = {
  title: string;
  message?: string;
  buttons: AlertDialogButton[];
  cancelable: boolean;
};

type ShowFn = (request: AlertDialogRequest) => void;

// Hosts register in mount order; the most recently mounted one shows the
// dialog. The root host covers normal screens, and a host mounted inside a
// native <Modal> takes over while that modal is open (a second native modal
// cannot be presented on top of another one on iOS).
const hosts: ShowFn[] = [];

/**
 * In-app replacement for Alert.alert confirmations. Same argument shape as
 * Alert.alert, so call sites only change the function name.
 */
export function showAlertDialog(
  title: string,
  message?: string,
  buttons?: AlertDialogButton[],
  options?: AlertDialogOptions,
): void {
  const resolvedButtons = buttons?.length ? buttons : [{ text: "OK" }];
  const show = hosts[hosts.length - 1];

  if (!show) {
    // No host mounted (should not happen) — fall back to the system alert.
    Alert.alert(title, message, resolvedButtons, options);
    return;
  }

  show({
    title,
    message,
    buttons: resolvedButtons,
    cancelable: options?.cancelable ?? true,
  });
}

export function AlertDialogHost() {
  const [request, setRequest] = useState<AlertDialogRequest | null>(null);
  const progress = useRef(new Animated.Value(0)).current;

  const show = useCallback<ShowFn>((next) => setRequest(next), []);

  useEffect(() => {
    hosts.push(show);
    return () => {
      const index = hosts.lastIndexOf(show);
      if (index !== -1) hosts.splice(index, 1);
    };
  }, [show]);

  useEffect(() => {
    if (!request) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [request, progress]);

  const cancelButton = request?.buttons.find((b) => b.style === "cancel");

  const handlePress = useCallback((button: AlertDialogButton) => {
    // Close first so an onPress that opens a follow-up dialog replaces this one.
    setRequest(null);
    void button.onPress?.();
  }, []);

  const dismiss = useCallback(() => {
    if (request?.cancelable && cancelButton) handlePress(cancelButton);
  }, [request?.cancelable, cancelButton, handlePress]);

  useEffect(() => {
    if (!request) return;
    // Swallow back presses while open so the screen underneath doesn't navigate.
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [request, dismiss]);

  if (!request) return null;

  const isDestructive = request.buttons.some((b) => b.style === "destructive");
  const stacked = request.buttons.length > 2;
  // Cancel sits on the left in a row and at the bottom when stacked.
  const ordered = stacked
    ? [
        ...request.buttons.filter((b) => b.style !== "cancel"),
        ...request.buttons.filter((b) => b.style === "cancel"),
      ]
    : [
        ...request.buttons.filter((b) => b.style === "cancel"),
        ...request.buttons.filter((b) => b.style !== "cancel"),
      ];

  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.94, 1],
  });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[styles.backdrop, { opacity: progress }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityLabel="Dismiss dialog"
        />
      </Animated.View>

      <View style={styles.center} pointerEvents="box-none">
        <Animated.View
          style={[styles.card, { opacity: progress, transform: [{ scale }] }]}
          accessibilityViewIsModal
          accessibilityRole="alert"
        >
          <View
            style={[
              styles.iconWrap,
              isDestructive ? styles.iconWrapDanger : styles.iconWrapDefault,
            ]}
          >
            <Feather
              name={isDestructive ? "alert-triangle" : "help-circle"}
              size={22}
              color={isDestructive ? AUTH_COLORS.error : AUTH_COLORS.green}
            />
          </View>

          <Text style={styles.title}>{request.title}</Text>
          {request.message ? (
            <Text style={styles.message}>{request.message}</Text>
          ) : null}

          <View style={stacked ? styles.buttonsStacked : styles.buttonsRow}>
            {ordered.map((button, index) => {
              const variant =
                button.style === "cancel"
                  ? styles.buttonCancel
                  : button.style === "destructive"
                    ? styles.buttonDanger
                    : styles.buttonPrimary;
              const textVariant =
                button.style === "cancel"
                  ? styles.buttonTextCancel
                  : styles.buttonTextFilled;

              return (
                <TouchableOpacity
                  key={`${button.text}-${index}`}
                  onPress={() => handlePress(button)}
                  style={[
                    styles.button,
                    stacked ? styles.buttonStacked : styles.buttonInRow,
                    variant,
                  ]}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                >
                  <Text style={[styles.buttonText, textVariant]}>
                    {button.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "rgba(15, 23, 42, 0.55)",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: AUTH_COLORS.white,
    borderRadius: 20,
    paddingTop: 24,
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },
  iconWrapDefault: {
    backgroundColor: "rgba(187, 247, 208, 0.6)",
  },
  iconWrapDanger: {
    backgroundColor: "rgba(254, 202, 202, 0.6)",
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    textAlign: "center",
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    lineHeight: 22,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
  },
  buttonsRow: {
    flexDirection: "row",
    alignSelf: "stretch",
    marginTop: 22,
    gap: 10,
  },
  buttonsStacked: {
    alignSelf: "stretch",
    marginTop: 22,
    gap: 10,
  },
  button: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  buttonInRow: {
    flex: 1,
  },
  buttonStacked: {
    alignSelf: "stretch",
  },
  buttonPrimary: {
    backgroundColor: AUTH_COLORS.green,
  },
  buttonDanger: {
    backgroundColor: AUTH_COLORS.error,
  },
  buttonCancel: {
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
    borderColor: "#D1D5DB",
  },
  buttonText: {
    fontSize: 15,
    fontWeight: "600",
    // Long labels ("Payment Confirmed") wrap to two lines in a row layout.
    textAlign: "center",
  },
  buttonTextFilled: {
    color: AUTH_COLORS.white,
  },
  buttonTextCancel: {
    color: AUTH_COLORS.textMuted,
  },
});
