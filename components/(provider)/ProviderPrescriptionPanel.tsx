/**
 * Provider clinical prescription upload / update / view panel.
 * Doctors and prescribing nurses (nurse + dispensing certificate) only.
 */

import { Feather } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { AUTH_COLORS } from "../../lib/authScreenTheme";
import { buildBackendAssetUrl } from "../../lib/backend";
import {
  getPrescriptionByRequest,
  PrescriptionRecord,
  updateProviderPrescription,
  uploadProviderPrescription,
} from "../../lib/prescription";
import PrescriptionViewerModal from "../PrescriptionViewerModal";

const EDITABLE_ACTIVE_STATUSES = new Set([
  "in_progress",
  "in_call",
]);

const EDIT_WINDOW_MS = 24 * 60 * 60 * 1000;

type Props = {
  requestId: string;
  requestStatus: string;
  consultationCompletedAt?: string | Date | null;
  requestUpdatedAt?: string | Date | null;
  canIssue: boolean;
};

function canEditInWindow(
  status: string,
  consultationCompletedAt?: string | Date | null,
  requestUpdatedAt?: string | Date | null,
): boolean {
  if (EDITABLE_ACTIVE_STATUSES.has(status)) {
    return true;
  }
  if (status !== "completed") {
    return false;
  }
  const completedRaw = consultationCompletedAt || requestUpdatedAt;
  if (!completedRaw) {
    return false;
  }
  const completedAt = new Date(completedRaw).getTime();
  if (Number.isNaN(completedAt)) {
    return false;
  }
  return Date.now() <= completedAt + EDIT_WINDOW_MS;
}

export default function ProviderPrescriptionPanel({
  requestId,
  requestStatus,
  consultationCompletedAt,
  requestUpdatedAt,
  canIssue,
}: Props) {
  const [prescription, setPrescription] = useState<PrescriptionRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);

  const editable = canEditInWindow(
    requestStatus,
    consultationCompletedAt,
    requestUpdatedAt,
  );

  const loadPrescription = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getPrescriptionByRequest(requestId);
      if (data?.source === "provider_issued") {
        setPrescription(data);
      } else {
        setPrescription(null);
      }
    } catch (error) {
      console.warn("Failed to load provider prescription:", error);
    } finally {
      setLoading(false);
    }
  }, [requestId]);

  useEffect(() => {
    if (!canIssue) return;
    void loadPrescription();
  }, [canIssue, loadPrescription]);

  if (!canIssue) {
    return null;
  }

  // Upload / update only once consultation has started (or within 24h after complete)
  if (
    !EDITABLE_ACTIVE_STATUSES.has(requestStatus) &&
    requestStatus !== "completed"
  ) {
    return null;
  }

  const viewerUrl = prescription?.prescriptionImage
    ? buildBackendAssetUrl("images", prescription.prescriptionImage)
    : null;

  const openFile = () => {
    if (!viewerUrl) {
      Alert.alert("Unavailable", "Prescription file URL could not be built.");
      return;
    }
    setViewerVisible(true);
  };

  const uploadFile = async (file: {
    uri: string;
    name: string;
    mimeType: string;
  }) => {
    try {
      setUploading(true);
      const result = prescription?._id
        ? await updateProviderPrescription(prescription._id, file)
        : await uploadProviderPrescription(requestId, file);
      setPrescription(result);
      Alert.alert(
        "Success",
        prescription?._id
          ? "Prescription updated successfully."
          : "Prescription uploaded successfully.",
      );
    } catch (error: any) {
      Alert.alert(
        "Upload failed",
        error?.message || "Could not upload the prescription.",
      );
    } finally {
      setUploading(false);
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow photo library access to upload a prescription image.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    const asset = result.canceled ? null : result.assets?.[0] ?? null;
    if (!asset) return;

    const mime = (asset.mimeType || "image/jpeg").toLowerCase();
    if (!["image/jpeg", "image/jpg", "image/png"].includes(mime)) {
      Alert.alert("Invalid file", "Only JPEG and PNG images are allowed.");
      return;
    }

    await uploadFile({
      uri: asset.uri,
      name: asset.fileName || `prescription_${Date.now()}.jpg`,
      mimeType: mime === "image/jpg" ? "image/jpeg" : mime,
    });
  };

  const pickPdf = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    const asset = result.canceled ? null : result.assets?.[0] ?? null;
    if (!asset) return;

    const documentAsset = asset as DocumentPicker.DocumentPickerAsset & {
      fileCopyUri?: string | null;
    };

    await uploadFile({
      uri: documentAsset.fileCopyUri || documentAsset.uri,
      name: asset.name || `prescription_${Date.now()}.pdf`,
      mimeType: "application/pdf",
    });
  };

  const promptPick = () => {
    if (!editable) {
      Alert.alert(
        "Window closed",
        "Prescriptions can only be uploaded or updated after the consultation has started, or within 24 hours after completion.",
      );
      return;
    }

    Alert.alert("Upload prescription", "Choose a file type", [
      { text: "Photo (JPEG/PNG)", onPress: () => void pickImage() },
      { text: "PDF document", onPress: () => void pickPdf() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  return (
    <>
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Feather name="file-text" size={16} color={AUTH_COLORS.greenDark} />
          <Text style={styles.title}>Clinical prescription</Text>
        </View>

        {loading ? (
          <ActivityIndicator color={AUTH_COLORS.green} style={{ marginTop: 8 }} />
        ) : prescription?.prescriptionImage ? (
          <>
            <Text style={styles.meta}>
              {prescription.fileType === "pdf" ? "PDF" : "Image"} uploaded
              {editable ? " — you can update within the allowed window" : ""}
            </Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={openFile}
                activeOpacity={0.85}
              >
                <Feather name="eye" size={15} color={AUTH_COLORS.greenDark} />
                <Text style={styles.secondaryBtnText}>View</Text>
              </TouchableOpacity>
              {editable ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={promptPick}
                  disabled={uploading}
                  activeOpacity={0.85}
                >
                  {uploading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <>
                      <Feather name="upload" size={15} color="#fff" />
                      <Text style={styles.primaryBtnText}>Update</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.meta}>
              {editable
                ? "Upload a PDF or image prescription for the patient (JPEG, PNG, or PDF)."
                : "The upload window for this consultation has closed."}
            </Text>
            {editable ? (
              <TouchableOpacity
                style={[styles.primaryBtn, styles.primaryBtnFull]}
                onPress={promptPick}
                disabled={uploading}
                activeOpacity={0.85}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="upload" size={15} color="#fff" />
                    <Text style={styles.primaryBtnText}>Upload prescription</Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}
          </>
        )}
      </View>

      <PrescriptionViewerModal
        visible={viewerVisible}
        url={viewerUrl}
        fileType={prescription?.fileType}
        title="Clinical prescription"
        onClose={() => setViewerVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: AUTH_COLORS.inputBorder,
    backgroundColor: AUTH_COLORS.white,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  meta: {
    fontSize: 12,
    lineHeight: 18,
    color: AUTH_COLORS.textMuted,
    marginBottom: 10,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: AUTH_COLORS.green,
    paddingVertical: 12,
    borderRadius: 12,
  },
  primaryBtnFull: {
    flex: 0,
    alignSelf: "stretch",
  },
  primaryBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: AUTH_COLORS.greenSoft,
    borderWidth: 1,
    borderColor: AUTH_COLORS.inputBorder,
    paddingVertical: 12,
    borderRadius: 12,
  },
  secondaryBtnText: {
    color: AUTH_COLORS.greenDark,
    fontSize: 13,
    fontWeight: "700",
  },
});
