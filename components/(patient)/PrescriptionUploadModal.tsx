/**
 * PrescriptionUploadModal
 *
 * Shown on the waiting-room for pharmacy-type requests.
 * Patient can upload / replace a JPEG or PDF prescription.
 * Editing is blocked once the pharmacist has accepted the prescription.
 */

import { Feather } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { PrescriptionFile, uploadPrescription } from "../../lib/prescription";

export interface PrescriptionData {
  _id: string;
  status: "pending_review" | "accepted" | "rejected" | "cancelled";
  prescriptionImage: string | null;
  fileType: "image" | "pdf" | null;
  rejectionReason?: string | null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  requestId: string;
  prescription: PrescriptionData | null;
  onUploaded: (prescription: PrescriptionData) => void;
}

export default function PrescriptionUploadModal({
  visible,
  onClose,
  requestId,
  prescription,
  onUploaded,
}: Props) {
  const [isUploading, setIsUploading] = useState(false);

  const canEdit =
    !prescription ||
    prescription.status === "pending_review" ||
    prescription.status === "rejected";

  // ── Pick from camera roll ──────────────────────────────────────────────────
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission needed",
        "Please allow access to your photo library to upload a prescription.",
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 0.85,
    });

    const asset = result.canceled ? null : result.assets?.[0] ?? null;

    if (asset) {
      await uploadFile({
        uri: asset.uri,
        name: asset.fileName || `prescription_${Date.now()}.jpg`,
        mimeType: asset.mimeType || "image/jpeg",
      });
    }
  };

  // ── Pick PDF document ──────────────────────────────────────────────────────
  const pickDocument = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });

    const asset = result.canceled ? null : result.assets?.[0] ?? null;

    if (asset) {
      const documentAsset = asset as DocumentPicker.DocumentPickerAsset & {
        fileCopyUri?: string | null;
      };

      await uploadFile({
        uri: documentAsset.fileCopyUri || documentAsset.uri,
        name: asset.name || `prescription_${Date.now()}.pdf`,
        mimeType: "application/pdf",
      });
    }
  };

  // ── Upload to backend ──────────────────────────────────────────────────────
  const uploadFile = async (file: { uri: string; name: string; mimeType: string }) => {
    try {
      setIsUploading(true);

      const uploaded = await uploadPrescription<PrescriptionData>({
        requestId,
        prescriptionId: prescription?._id,
        file,
      });

      onUploaded(uploaded);
      Alert.alert("Success", "Prescription uploaded successfully.");
      onClose();
    } catch (err: any) {
      console.error("Prescription upload error:", err);
      Alert.alert(
        "Upload Failed",
        err?.response?.data?.message || "Could not upload prescription. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  // ── Status label ───────────────────────────────────────────────────────────
  const renderStatusBadge = () => {
    if (!prescription) return null;
    const map: Record<string, { label: string; bg: string; text: string; icon: string }> = {
      pending_review: { label: "Awaiting Review", bg: "#FEF9C3", text: "#92400E", icon: "clock" },
      accepted:       { label: "Accepted",         bg: "#DCFCE7", text: "#166534", icon: "check-circle" },
      rejected:       { label: "Rejected — Re-upload", bg: "#FEE2E2", text: "#991B1B", icon: "x-circle" },
      cancelled:      { label: "Cancelled",         bg: "#F3F4F6", text: "#374151", icon: "slash" },
    };
    const meta = map[prescription.status] || map.pending_review;
    return (
      <View style={[styles.statusBadge, { backgroundColor: meta.bg }]}>
        <Feather name={meta.icon as any} size={13} color={meta.text} />
        <Text style={[styles.statusText, { color: meta.text }]}>{meta.label}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Prescription</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={22} color="#374151" />
            </TouchableOpacity>
          </View>

          {/* Status */}
          {renderStatusBadge()}

          {/* Rejection reason */}
          {prescription?.rejectionReason && prescription.status === "pending_review" && (
            <View style={styles.rejectionCard}>
              <Feather name="alert-triangle" size={14} color="#B45309" />
              <Text style={styles.rejectionText}>
                Rejection note: {prescription.rejectionReason}
              </Text>
            </View>
          )}

          {/* Current file indicator */}
          {prescription?.prescriptionImage && (
            <View style={styles.fileCard}>
              <Feather
                name={prescription.fileType === "pdf" ? "file-text" : "image"}
                size={20}
                color="#2563EB"
              />
              <Text style={styles.fileText} numberOfLines={1}>
                {prescription.fileType === "pdf"
                  ? "PDF prescription uploaded"
                  : "Image prescription uploaded"}
              </Text>
              <Feather name="check-circle" size={16} color="#16A34A" />
            </View>
          )}

          {/* Instructions */}
          <Text style={styles.instructions}>
            {prescription?.status === "accepted"
              ? "Your prescription has been accepted. Medication delivery is in progress."
              : "Upload a clear photo or PDF of your prescription. You can replace it until the pharmacist reviews it."}
          </Text>

          {/* Upload buttons — shown only if editable */}
          {canEdit && (
            <View style={styles.buttonGroup}>
              {isUploading ? (
                <ActivityIndicator size="large" color="#10B981" style={{ marginVertical: 20 }} />
              ) : (
                <>
                  <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                    <Feather name="image" size={18} color="#FFFFFF" />
                    <Text style={styles.uploadBtnText}>
                      {prescription?.prescriptionImage ? "Replace Image" : "Upload Image (JPEG)"}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={[styles.uploadBtn, styles.uploadBtnSecondary]} onPress={pickDocument}>
                    <Feather name="file-text" size={18} color="#2563EB" />
                    <Text style={[styles.uploadBtnText, { color: "#2563EB" }]}>
                      {prescription?.prescriptionImage ? "Replace PDF" : "Upload PDF"}
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    marginBottom: 12,
    gap: 6,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
  },
  rejectionCard: {
    backgroundColor: "#FEF3C7",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 12,
  },
  rejectionText: {
    fontSize: 13,
    color: "#92400E",
    flex: 1,
  },
  fileCard: {
    backgroundColor: "#EFF6FF",
    borderRadius: 10,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  fileText: {
    fontSize: 13,
    color: "#1D4ED8",
    flex: 1,
  },
  instructions: {
    fontSize: 13,
    color: "#6B7280",
    lineHeight: 18,
    marginBottom: 16,
  },
  buttonGroup: {
    gap: 10,
    marginBottom: 16,
  },
  uploadBtn: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadBtnSecondary: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  uploadBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  closeBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
  },
});
