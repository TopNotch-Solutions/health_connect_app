import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import {
  AppBottomSheetCloseHeader,
  appModalBottomSheetStyles,
} from "../app/AppBottomSheetUI";
import { AlertDialogHost, showAlertDialog } from "../AlertDialog";
import { KEYBOARD_AWARE_EXTRA_SCROLL } from "../ScreenLayout";
import apiClient from "../../lib/api";
import { AUTH_COLORS } from "../../lib/authScreenTheme";
import {
  emptyPostalAddress,
  PostalAddressPayload,
  PostalAddressRecord,
  toPostalAddressPayload,
  validatePostalAddress,
} from "../../lib/postalAddress";
import PostalAddressFormFields from "./PostalAddressFormFields";

type PostalAddressConfirmModalProps = {
  visible: boolean;
  onClose: () => void;
  defaultAddressee?: string;
  onConfirmed: (address: PostalAddressPayload) => void;
  title?: string;
  bannerTitle?: string;
  bannerBody?: string;
  confirmLabel?: string;
};

export default function PostalAddressConfirmModal({
  visible,
  onClose,
  defaultAddressee = "",
  onConfirmed,
  title = "Confirm postal address",
  bannerTitle = "NamPost details for your claim",
  bannerBody = "Medical aid claims need your Namibian postal address. Review or update it, then continue.",
  confirmLabel = "Confirm & continue",
}: PostalAddressConfirmModalProps) {
  const [form, setForm] = useState<PostalAddressPayload>(
    emptyPostalAddress({ addressee: defaultAddressee }),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hasSavedAddress, setHasSavedAddress] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const response = await apiClient.get("/app/postal-address");
        const data = (response.data?.data ??
          null) as PostalAddressRecord | null;
        if (cancelled) return;

        if (data && data.addressType) {
          setHasSavedAddress(true);
          setForm(
            emptyPostalAddress({
              addressee: data.addressee || defaultAddressee,
              addressType: data.addressType,
              boxNumber: data.boxNumber,
              bagNumber: data.bagNumber,
              unitOrAdditional: data.unitOrAdditional,
              premises: data.premises,
              subLocality: data.subLocality,
              locality: data.locality,
              postOffice: data.postOffice,
              postcode: data.postcode,
              country: data.country || "NAMIBIA",
            }),
          );
        } else {
          setHasSavedAddress(false);
          setForm(emptyPostalAddress({ addressee: defaultAddressee }));
        }
      } catch (error: any) {
        console.error("Failed to load postal address:", error);
        if (!cancelled) {
          setHasSavedAddress(false);
          setForm(emptyPostalAddress({ addressee: defaultAddressee }));
          setLoadError(
            error?.response?.data?.message ||
              "Could not load your saved postal address. You can still enter one.",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [visible, defaultAddressee]);

  const handleConfirm = async () => {
    const error = validatePostalAddress(form);
    if (error) {
      showAlertDialog("Postal Address", error);
      return;
    }

    const payload = toPostalAddressPayload(form);
    setIsSaving(true);
    try {
      await apiClient.put("/app/postal-address", payload);
      onConfirmed(payload);
    } catch (err: any) {
      showAlertDialog(
        "Error",
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save postal address.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={appModalBottomSheetStyles.overlay}>
        <View
          style={[
            appModalBottomSheetStyles.sheet,
            appModalBottomSheetStyles.sheetTall,
            styles.sheet,
          ]}
        >
          <View style={appModalBottomSheetStyles.handle} />

          <View style={styles.headerWrap}>
            <AppBottomSheetCloseHeader title={title} onClose={onClose} />
            <Text style={styles.headerSub}>{bannerBody}</Text>
          </View>

          <KeyboardAwareScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={KEYBOARD_AWARE_EXTRA_SCROLL}
            extraHeight={120}
          >
            {isLoading ? (
              <View style={styles.statusPanel}>
                <ActivityIndicator color={AUTH_COLORS.green} />
                <Text style={styles.statusTitle}>Loading address?</Text>
                <Text style={styles.statusBody}>
                  Pulling your saved NamPost details.
                </Text>
              </View>
            ) : (
              <>
                {loadError ? (
                  <Text style={styles.loadError}>{loadError}</Text>
                ) : null}

                <View style={styles.statusRow}>
                  <Feather
                    name={hasSavedAddress ? "check" : "mail"}
                    size={14}
                    color={AUTH_COLORS.green}
                  />
                  <Text style={styles.statusRowText}>
                    {hasSavedAddress
                      ? "Saved address loaded ? edit if needed, then confirm."
                      : `${bannerTitle}. Fill in your details below.`}
                  </Text>
                </View>

                <PostalAddressFormFields
                  form={form}
                  onChange={setForm}
                  editable={!isSaving}
                  inputStyle={styles.fieldInput}
                  labelStyle={styles.fieldLabel}
                />
              </>
            )}
          </KeyboardAwareScrollView>

          <View style={[appModalBottomSheetStyles.footer, styles.footer]}>
            <TouchableOpacity
              onPress={onClose}
              disabled={isSaving}
              style={styles.cancelBtn}
              activeOpacity={0.88}
            >
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleConfirm}
              disabled={isLoading || isSaving}
              style={[
                styles.submitBtn,
                (isLoading || isSaving) && styles.submitBtnDisabled,
              ]}
              activeOpacity={0.88}
            >
              {isSaving ? (
                <ActivityIndicator color={AUTH_COLORS.white} />
              ) : (
                <Text style={styles.submitBtnText}>{confirmLabel}</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
      <AlertDialogHost active={visible} embedded />
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: AUTH_COLORS.bg,
  },
  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
    paddingBottom: 4,
  },
  headerSub: {
    marginTop: -10,
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 20,
    color: AUTH_COLORS.textMuted,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  statusPanel: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 140,
    paddingHorizontal: 18,
    paddingVertical: 22,
    borderRadius: 16,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  statusTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: AUTH_COLORS.textDark,
    textAlign: "center",
  },
  statusBody: {
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.textMuted,
    textAlign: "center",
  },
  loadError: {
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.error,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 18,
    paddingVertical: 4,
  },
  statusRowText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    color: AUTH_COLORS.textMuted,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.3,
    color: AUTH_COLORS.textDark,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  fieldInput: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingLeft: 18,
    paddingVertical: 14,
    minHeight: 54,
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 16,
    backgroundColor: AUTH_COLORS.white,
    borderColor: AUTH_COLORS.inputBorder,
    color: AUTH_COLORS.textDark,
    shadowColor: "#14532D",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 1,
  },
  footer: {
    gap: 10,
  },
  cancelBtn: {
    backgroundColor: AUTH_COLORS.white,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
  },
  cancelBtnText: {
    color: AUTH_COLORS.textDark,
    fontSize: 16,
    fontWeight: "700",
  },
  submitBtn: {
    backgroundColor: AUTH_COLORS.green,
    borderRadius: 999,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    backgroundColor: "#D1D5DB",
  },
  submitBtnText: {
    color: AUTH_COLORS.white,
    fontSize: 16,
    fontWeight: "800",
  },
});
