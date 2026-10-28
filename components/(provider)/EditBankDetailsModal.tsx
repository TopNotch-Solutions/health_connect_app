import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-aware-scroll-view";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppTextInput as TextInput } from "../AppTextInput";
import { AlertDialogHost } from "../AlertDialog";
import { KEYBOARD_AWARE_EXTRA_SCROLL } from "../ScreenLayout";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../lib/api";
import { AUTH_COLORS } from "../../lib/authScreenTheme";
import { withIosStandaloneTextInputStyle } from "../../lib/iosInputStyles";
import {
  BankDetailsField,
  BankDetailsPayload,
  BankDetailsRecord,
  emptyBankDetails,
  isMaskedBankField,
  maskBankField,
  toBankDetailsPayload,
  validateBankDetails,
} from "../../lib/bankDetails";

/** Ensure every loaded field is display-masked (first 2 + last 2 + * middle). */
function maskLoadedBankDetails(
  data: Partial<BankDetailsPayload>,
): BankDetailsPayload {
  return emptyBankDetails({
    accountHolder: maskBankField(data.accountHolder),
    bankName: maskBankField(data.bankName),
    branchName: maskBankField(data.branchName),
    branchCode: maskBankField(data.branchCode),
    accountNumber: maskBankField(data.accountNumber),
    accountType: maskBankField(data.accountType),
  });
}

type EditBankDetailsModalProps = {
  visible: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

const FIELD_KEYS: BankDetailsField[] = [
  "accountHolder",
  "bankName",
  "branchName",
  "branchCode",
  "accountNumber",
  "accountType",
];

export default function EditBankDetailsModal({
  visible,
  onClose,
  onSaved,
}: EditBankDetailsModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<BankDetailsPayload>(
    emptyBankDetails({ accountHolder: user?.fullname || "" }),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  /** Masked values loaded from API; restored on blur if the user leaves a field empty. */
  const [loadedMasked, setLoadedMasked] = useState<BankDetailsPayload>(
    emptyBankDetails(),
  );

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      setLoadError(null);
      setLoadedMasked(emptyBankDetails());
      try {
        const response = await apiClient.get("/app/bank-details");
        const data = (response.data?.data ?? null) as BankDetailsRecord | null;
        if (cancelled) return;

        if (
          data &&
          (data.accountHolder ||
            data.bankName ||
            data.branchName ||
            data.branchCode ||
            data.accountNumber ||
            data.accountType)
        ) {
          const masked = maskLoadedBankDetails(data);
          setLoadedMasked(masked);
          setForm(masked);
        } else {
          // New entry — prefill holder name unmasked so they can edit it.
          setForm(emptyBankDetails({ accountHolder: user?.fullname || "" }));
        }
      } catch (error: any) {
        console.error("Failed to load bank details:", error);
        if (!cancelled) {
          setForm(emptyBankDetails({ accountHolder: user?.fullname || "" }));
          setLoadError(
            error?.response?.data?.message ||
              "Could not load your bank details. You can still enter them.",
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
  }, [visible, user?.fullname]);

  const updateField = <K extends BankDetailsField>(
    key: K,
    value: BankDetailsPayload[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const clearMaskedOnFocus = (key: BankDetailsField) => {
    setForm((prev) =>
      isMaskedBankField(prev[key]) ? { ...prev, [key]: "" } : prev,
    );
  };

  const restoreMaskedOnBlur = (key: BankDetailsField) => {
    setForm((prev) => {
      if (String(prev[key] || "").trim()) return prev;
      const masked = loadedMasked[key];
      if (!masked) return prev;
      return { ...prev, [key]: masked };
    });
  };

  const handleSave = async () => {
    // If a field was cleared and left empty, fall back to the loaded mask
    // so the server can keep the existing full value.
    const formToSave = { ...form };
    for (const key of FIELD_KEYS) {
      if (!String(formToSave[key] || "").trim() && loadedMasked[key]) {
        formToSave[key] = loadedMasked[key];
      }
    }

    const error = validateBankDetails(formToSave);
    if (error) {
      Alert.alert("Bank Details", error);
      return;
    }

    const payload = toBankDetailsPayload(formToSave);
    setIsSaving(true);
    try {
      await apiClient.put("/app/bank-details", payload);
      Alert.alert("Success", "Bank details saved.");
      onSaved?.();
      onClose();
    } catch (err: any) {
      Alert.alert(
        "Error",
        err?.response?.data?.message ||
          err?.message ||
          "Failed to save bank details.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const hasLoadedDetails = FIELD_KEYS.some((key) =>
    Boolean(loadedMasked[key]),
  );

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.root}>
        <SafeAreaView edges={["top"]} style={styles.topSafe}>
          <View style={styles.hero}>
            <View style={styles.heroOrb} pointerEvents="none" />
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={12}
              activeOpacity={0.85}
            >
              <Feather name="x" size={22} color={AUTH_COLORS.white} />
            </TouchableOpacity>
            <Text style={styles.heroKicker}>Account</Text>
            <Text style={styles.heroTitle}>Bank details</Text>
            <Text style={styles.heroSub}>
              Practice banking details for medical aid claim statements.
            </Text>
          </View>
        </SafeAreaView>

        <View style={styles.body}>
          <KeyboardAwareScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            enableOnAndroid
            enableAutomaticScroll
            extraScrollHeight={KEYBOARD_AWARE_EXTRA_SCROLL}
            extraHeight={120}
          >
            {loadError ? (
              <Text style={styles.loadError}>{loadError}</Text>
            ) : null}

            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={AUTH_COLORS.green} size="large" />
                <Text style={styles.loadingText}>Loading bank details…</Text>
              </View>
            ) : (
              <>
                {hasLoadedDetails ? (
                  <Text style={styles.hint}>
                    Details are masked for security (first and last 2
                    characters only). Tap a field to replace it, or leave it
                    unchanged to keep the saved value.
                  </Text>
                ) : null}

                <Text style={styles.label}>Account holder *</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle(styles.input)}
                  placeholder="e.g. DR ANNA HASHEELA"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={form.accountHolder}
                  onChangeText={(v) => updateField("accountHolder", v)}
                  onFocus={() => clearMaskedOnFocus("accountHolder")}
                  onBlur={() => restoreMaskedOnBlur("accountHolder")}
                  editable={!isSaving}
                  autoCapitalize="characters"
                />

                <Text style={styles.label}>Bank name *</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle(styles.input)}
                  placeholder="e.g. FIRST NATIONAL BANK NAMIBIA"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={form.bankName}
                  onChangeText={(v) => updateField("bankName", v)}
                  onFocus={() => clearMaskedOnFocus("bankName")}
                  onBlur={() => restoreMaskedOnBlur("bankName")}
                  editable={!isSaving}
                  autoCapitalize="characters"
                />

                <Text style={styles.label}>Branch name *</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle(styles.input)}
                  placeholder="e.g. NAMIBIA"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={form.branchName}
                  onChangeText={(v) => updateField("branchName", v)}
                  onFocus={() => clearMaskedOnFocus("branchName")}
                  onBlur={() => restoreMaskedOnBlur("branchName")}
                  editable={!isSaving}
                  autoCapitalize="characters"
                />

                <Text style={styles.label}>Branch code *</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle(styles.input)}
                  placeholder="e.g. 280071"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={form.branchCode}
                  onChangeText={(v) => {
                    if (isMaskedBankField(form.branchCode)) {
                      updateField(
                        "branchCode",
                        v.replace(/[^\dA-Za-z-]/g, ""),
                      );
                      return;
                    }
                    updateField(
                      "branchCode",
                      v.replace(/[^\dA-Za-z-]/g, ""),
                    );
                  }}
                  onFocus={() => clearMaskedOnFocus("branchCode")}
                  onBlur={() => restoreMaskedOnBlur("branchCode")}
                  editable={!isSaving}
                  keyboardType="number-pad"
                />

                <Text style={styles.label}>Account number *</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle(styles.input)}
                  placeholder={
                    loadedMasked.accountNumber
                      ? "Enter new number to change"
                      : "e.g. 62156218432"
                  }
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={form.accountNumber}
                  onChangeText={(v) => {
                    if (isMaskedBankField(form.accountNumber)) {
                      updateField(
                        "accountNumber",
                        v.replace(/\D/g, "").slice(0, 20),
                      );
                      return;
                    }
                    updateField(
                      "accountNumber",
                      v.replace(/\D/g, "").slice(0, 20),
                    );
                  }}
                  onFocus={() => clearMaskedOnFocus("accountNumber")}
                  onBlur={() => restoreMaskedOnBlur("accountNumber")}
                  editable={!isSaving}
                  keyboardType="number-pad"
                  maxLength={20}
                />

                <Text style={styles.label}>Account type *</Text>
                <TextInput
                  style={withIosStandaloneTextInputStyle(styles.input)}
                  placeholder="e.g. PLATINUM LIFESTYLE"
                  placeholderTextColor={AUTH_COLORS.placeholder}
                  value={form.accountType}
                  onChangeText={(v) => updateField("accountType", v)}
                  onFocus={() => clearMaskedOnFocus("accountType")}
                  onBlur={() => restoreMaskedOnBlur("accountType")}
                  editable={!isSaving}
                  autoCapitalize="characters"
                />
              </>
            )}
          </KeyboardAwareScrollView>

          <SafeAreaView edges={["bottom"]} style={styles.footerSafe}>
            <View style={styles.footer}>
              <TouchableOpacity
                onPress={handleSave}
                disabled={isLoading || isSaving}
                style={[
                  styles.saveButton,
                  (isLoading || isSaving) && styles.saveButtonDisabled,
                ]}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <>
                    <Feather name="check" size={18} color="#FFFFFF" />
                    <Text style={styles.saveButtonText}>Save bank details</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </View>
      </View>
      <AlertDialogHost active={visible} embedded />
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#0F3D24",
  },
  topSafe: {
    backgroundColor: "#0F3D24",
  },
  hero: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    overflow: "hidden",
  },
  heroOrb: {
    position: "absolute",
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(34, 197, 94, 0.28)",
  },
  closeButton: {
    alignSelf: "flex-end",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  heroKicker: {
    fontSize: 12,
    fontWeight: "700",
    color: "rgba(187, 247, 208, 0.95)",
    letterSpacing: 1,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: "800",
    color: AUTH_COLORS.white,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 21,
    color: "rgba(255,255,255,0.78)",
    maxWidth: 300,
  },
  body: {
    flex: 1,
    backgroundColor: AUTH_COLORS.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -18,
    overflow: "hidden",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 24,
  },
  loadingWrap: {
    paddingVertical: 48,
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: AUTH_COLORS.textMuted,
  },
  loadError: {
    color: "#B45309",
    fontSize: 13,
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    lineHeight: 17,
    color: AUTH_COLORS.textMuted,
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 8,
  },
  input: {
    backgroundColor: "transparent",
    borderWidth: 0,
    borderBottomWidth: 2,
    borderColor: AUTH_COLORS.inputBorder,
    borderRadius: 0,
    paddingHorizontal: 0,
    paddingVertical: 8,
    fontSize: 16,
    color: AUTH_COLORS.textDark,
    marginBottom: 10,
  },
  footerSafe: {
    backgroundColor: AUTH_COLORS.bg,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.bg,
  },
  saveButton: {
    backgroundColor: "#0F3D24",
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: AUTH_COLORS.white,
    fontSize: 16,
    fontWeight: "700",
  },
});
