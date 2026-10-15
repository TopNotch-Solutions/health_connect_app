import { Feather } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KEYBOARD_VERTICAL_OFFSET } from "./ScreenLayout";
import PostalAddressFormFields from "./(patient)/PostalAddressFormFields";
import { useAuth } from "../context/AuthContext";
import apiClient from "../lib/api";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import {
  emptyPostalAddress,
  PostalAddressPayload,
  PostalAddressRecord,
  toPostalAddressPayload,
  validatePostalAddress,
} from "../lib/postalAddress";

type EditPostalAddressModalProps = {
  visible: boolean;
  onClose: () => void;
};

export default function EditPostalAddressModal({
  visible,
  onClose,
}: EditPostalAddressModalProps) {
  const { user } = useAuth();
  const [form, setForm] = useState<PostalAddressPayload>(
    emptyPostalAddress({ addressee: user?.fullname || "" }),
  );
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;

    let cancelled = false;
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.get("/app/postal-address");
        const data = (response.data?.data ??
          null) as PostalAddressRecord | null;
        if (cancelled) return;

        if (data && data.addressType) {
          setForm(
            emptyPostalAddress({
              addressee: data.addressee || user?.fullname || "",
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
          setForm(emptyPostalAddress({ addressee: user?.fullname || "" }));
        }
      } catch (error) {
        console.error("Failed to load postal address:", error);
        if (!cancelled) {
          setForm(emptyPostalAddress({ addressee: user?.fullname || "" }));
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

  const handleSave = async () => {
    const error = validatePostalAddress(form);
    if (error) {
      Alert.alert("Postal Address", error);
      return;
    }

    const payload = toPostalAddressPayload(form);
    setIsSaving(true);
    try {
      await apiClient.put("/app/postal-address", payload);
      Alert.alert("Success", "Postal address saved successfully");
      onClose();
    } catch (err: any) {
      Alert.alert(
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
            <Text style={styles.heroTitle}>Postal address</Text>
            <Text style={styles.heroSub}>
              Namibian postal details used for medical aid claims.
            </Text>
          </View>
        </SafeAreaView>

        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={KEYBOARD_VERTICAL_OFFSET}
        >
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isLoading ? (
              <View style={styles.loadingWrap}>
                <ActivityIndicator color={AUTH_COLORS.green} size="large" />
                <Text style={styles.loadingText}>
                  Loading postal address…
                </Text>
              </View>
            ) : (
              <View style={styles.sheet}>
                <PostalAddressFormFields
                  form={form}
                  onChange={setForm}
                  editable={!isSaving}
                  inputStyle={styles.input}
                  labelStyle={styles.label}
                  showPreview
                />
              </View>
            )}
          </ScrollView>

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
                    <Text style={styles.saveButtonText}>Save postal address</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </View>
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
  sheet: {
    paddingBottom: 8,
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
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: AUTH_COLORS.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 6,
    marginTop: 10,
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
    marginBottom: 4,
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
