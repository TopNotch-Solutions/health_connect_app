import { Feather } from "@expo/vector-icons";
import React, { useCallback, useEffect, useId, useState } from "react";
import {
  Alert,
  BackHandler,
  Modal,
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

type HostEntry = {
  id: string;
  show: (request: AlertDialogRequest) => void;
};

/**
 * Persist across Fast Refresh. Capturing Alert.alert after a patch would
 * recurse forever when hosts are empty.
 */
const globalAlert = globalThis as typeof globalThis & {
  __hcNativeAlert?: typeof Alert.alert;
  __hcAlertHosts?: HostEntry[];
  __hcAlertPatched?: boolean;
};

// Capture the real native Alert once. Never re-bind after patching or Fast
// Refresh will make the "native" fallback recurse into showAlertDialog.
if (typeof globalAlert.__hcNativeAlert !== "function") {
  globalAlert.__hcNativeAlert = Alert.alert.bind(Alert);
}

// Fresh host list on every module load; effects re-register via HOST_GENERATION.
globalAlert.__hcAlertHosts = [];

const nativeAlert = globalAlert.__hcNativeAlert;
const hosts = globalAlert.__hcAlertHosts;

/** Bumps on every module reload so hosts re-register after Fast Refresh. */
const HOST_GENERATION = Date.now();

// iOS silently drops a Modal if another Modal is still dismissing.
const MODAL_PRESENT_GAP_MS = 350;
let lastDialogDismissAt = 0;
let presentTimer: ReturnType<typeof setTimeout> | null = null;

function markDialogDismissed() {
  lastDialogDismissAt = Date.now();
}

function presentToTopHost(request: AlertDialogRequest): void {
  const top = hosts[hosts.length - 1];
  if (!top) {
    nativeAlert(
      request.title,
      request.message,
      request.buttons,
      { cancelable: request.cancelable },
    );
    return;
  }
  top.show(request);
}

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
  const request: AlertDialogRequest = {
    title,
    message,
    buttons: resolvedButtons,
    cancelable: options?.cancelable ?? true,
  };

  if (presentTimer) {
    clearTimeout(presentTimer);
    presentTimer = null;
  }

  const wait = Math.max(
    0,
    MODAL_PRESENT_GAP_MS - (Date.now() - lastDialogDismissAt),
  );

  if (wait > 0) {
    presentTimer = setTimeout(() => {
      presentTimer = null;
      presentToTopHost(request);
    }, wait);
    return;
  }

  presentToTopHost(request);
}

/**
 * Route every `Alert.alert(...)` call through the custom in-app dialog so
 * screens that still use the React Native Alert API get the branded popup.
 */
export function installAlertDialogPatch(): void {
  if (globalAlert.__hcAlertPatched) return;
  globalAlert.__hcAlertPatched = true;
  Alert.alert = ((
    title: string,
    message?: string,
    buttons?: AlertDialogButton[],
    options?: AlertDialogOptions,
  ) => {
    showAlertDialog(title, message, buttons, options);
  }) as typeof Alert.alert;
}

installAlertDialogPatch();

type AlertDialogHostProps = {
  /**
   * When false, this host does not receive dialogs. Pass the parent Modal's
   * `visible` so closed modals don't steal alerts into an invisible tree.
   */
  active?: boolean;
  /**
   * Use inside an already-open RN Modal. Renders as an absolute overlay
   * (iOS cannot stack a second Modal). Root host leaves this false and uses
   * a transparent Modal so dialogs appear above react-native-screens.
   */
  embedded?: boolean;
};

export function AlertDialogHost({
  active = true,
  embedded = false,
}: AlertDialogHostProps) {
  const id = useId();
  const [request, setRequest] = useState<AlertDialogRequest | null>(null);

  const show = useCallback((next: AlertDialogRequest) => {
    setRequest(next);
  }, []);

  useEffect(() => {
    installAlertDialogPatch();
  }, []);

  useEffect(() => {
    if (!active) {
      setRequest((prev) => {
        if (prev) markDialogDismissed();
        return null;
      });
      return;
    }

    const entry: HostEntry = { id, show };
    hosts.push(entry);
    return () => {
      const index = hosts.findIndex((h) => h.id === id);
      if (index !== -1) hosts.splice(index, 1);
    };
  }, [id, show, active, HOST_GENERATION]);

  const cancelButton = request?.buttons.find((b) => b.style === "cancel");

  const handlePress = useCallback(
    (button: AlertDialogButton) => {
      markDialogDismissed();
      setRequest(null);
      // Non-embedded hosts use RN Modal — wait for dismiss before follow-up UI.
      if (embedded) {
        void button.onPress?.();
        return;
      }
      setTimeout(() => {
        void button.onPress?.();
      }, MODAL_PRESENT_GAP_MS);
    },
    [embedded],
  );

  const dismiss = useCallback(() => {
    if (!request?.cancelable) return;
    if (cancelButton) {
      handlePress(cancelButton);
      return;
    }
    markDialogDismissed();
    setRequest(null);
  }, [request?.cancelable, cancelButton, handlePress]);

  useEffect(() => {
    if (!request) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      dismiss();
      return true;
    });
    return () => sub.remove();
  }, [request, dismiss]);

  const open = active && !!request;

  const isDestructive =
    !!request?.buttons.some((b) => b.style === "destructive");
  const stacked = (request?.buttons.length ?? 0) > 2;
  const ordered = request
    ? stacked
      ? [
          ...request.buttons.filter((b) => b.style !== "cancel"),
          ...request.buttons.filter((b) => b.style === "cancel"),
        ]
      : [
          ...request.buttons.filter((b) => b.style === "cancel"),
          ...request.buttons.filter((b) => b.style !== "cancel"),
        ]
    : [];

  const body = request ? (
    <View
      style={embedded ? styles.host : styles.modalRoot}
      pointerEvents="box-none"
    >
      <View style={styles.backdrop}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={dismiss}
          accessibilityLabel="Dismiss dialog"
        />
      </View>

      <View style={styles.center} pointerEvents="box-none">
        <View
          style={styles.card}
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
        </View>
      </View>
    </View>
  ) : null;

  if (embedded) {
    if (!open) return null;
    return body;
  }

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={dismiss}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 10000,
    elevation: 10000,
  },
  modalRoot: {
    flex: 1,
  },
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
    textAlign: "center",
  },
  buttonTextFilled: {
    color: AUTH_COLORS.white,
  },
  buttonTextCancel: {
    color: AUTH_COLORS.textMuted,
  },
});
