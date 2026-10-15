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
import {
  AppBottomSheetCloseHeader,
  appBottomSheetStyles,
  appModalBottomSheetStyles,
} from "../app/AppBottomSheetUI";
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
  title = "Confirm Postal Address",
  bannerTitle = "Namibian postal address required",
  bannerBody = "Medical aid claims need your NamPost postal address. Review or update it below, then confirm to continue.",
  confirmLabel = "Confirm & Continue",
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
      Alert.alert("Postal Address", error);
      return;
    }

    const payload = toPostalAddressPayload(form);
    setIsSaving(true);
    try {
      await apiClient.put("/app/postal-address", payload);
      onConfirmed(payload);
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
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View style={appModalBottomSheetStyles.overlay}>
          <View
            style={[
              appModalBottomSheetStyles.sheet,
              appModalBottomSheetStyles.sheetTall,
            ]}
          >
            <View style={appModalBottomSheetStyles.handle} />

            <View style={styles.headerWrap}>
              <AppBottomSheetCloseHeader title={title} onClose={onClose} />
            </View>

            <ScrollView
              style={styles.scrollBody}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={appBottomSheetStyles.warningBanner}>
                <View className="flex-row items-start">
                  <Feather name="mail" size={18} color="#92400E" />
                  <View className="flex-1 ml-3">
                    <Text style={appBottomSheetStyles.warningBannerTitle}>
                      {bannerTitle}
                    </Text>
                    <Text style={appBottomSheetStyles.warningBannerBody}>
                      {bannerBody}
                    </Text>
                  </View>
                </View>
              </View>

              {isLoading ? (
                <View className="py-10 items-center">
                  <ActivityIndicator color={AUTH_COLORS.green} size="large" />
                  <Text className="text-gray-600 mt-3 text-sm">
                    Loading your postal address…
                  </Text>
                </View>
              ) : (
                <>
                  {loadError ? (
                    <Text className="text-amber-800 text-xs mb-3">
                      {loadError}
                    </Text>
                  ) : null}

                  {hasSavedAddress ? (
                    <View className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 flex-row items-start">
                      <Feather name="check-circle" size={16} color="#16A34A" />
                      <Text className="text-xs text-green-800 ml-2 flex-1">
                        Saved address loaded. Edit if needed, then confirm.
                      </Text>
                    </View>
                  ) : (
                    <View className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4 flex-row items-start">
                      <Feather name="info" size={16} color="#2563EB" />
                      <Text className="text-xs text-blue-800 ml-2 flex-1">
                        No postal address on file yet. Fill in your Namibian
                        postal details below.
                      </Text>
                    </View>
                  )}

                  <PostalAddressFormFields
                    form={form}
                    onChange={setForm}
                    editable={!isSaving}
                  />
                </>
              )}
            </ScrollView>

            <View style={appModalBottomSheetStyles.footer}>
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
                  appBottomSheetStyles.primaryCta,
                  (isLoading || isSaving) && {
                    backgroundColor: "#D1D5DB",
                    borderColor: "#D1D5DB",
                  },
                ]}
                activeOpacity={0.88}
              >
                {isSaving ? (
                  <ActivityIndicator color={AUTH_COLORS.white} />
                ) : (
                  <Text style={appBottomSheetStyles.primaryCtaText}>
                    {confirmLabel}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  headerWrap: {
    paddingHorizontal: 24,
    paddingTop: 4,
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  cancelBtn: {
    backgroundColor: "#DC2626",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: "#B91C1C",
  },
  cancelBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
});
