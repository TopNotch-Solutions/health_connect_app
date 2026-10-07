/**
 * Patient view/download for provider-issued clinical prescriptions (in-app popup).
 */

import { Feather } from "@expo/vector-icons";
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
import { downloadPrescriptionFile } from "../../lib/downloadPrescription";
import {
  getPrescriptionByRequest,
  PrescriptionRecord,
} from "../../lib/prescription";
import PrescriptionViewerModal from "../PrescriptionViewerModal";

const VISIBLE_STATUSES = new Set([
  "arrived",
  "in_progress",
  "in_call",
  "ready_for_call",
  "completed",
]);

type Props = {
  requestId: string;
  requestStatus: string;
  /** When false, component renders nothing (e.g. pharmacy-only cards). */
  enabled?: boolean;
  compact?: boolean;
};

export default function PatientProviderPrescriptionView({
  requestId,
  requestStatus,
  enabled = true,
  compact = false,
}: Props) {
  const [prescription, setPrescription] = useState<PrescriptionRecord | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    if (!enabled || !requestId) return;
    if (!VISIBLE_STATUSES.has(requestStatus)) {
      setPrescription(null);
      return;
    }
    try {
      setLoading(true);
      const data = await getPrescriptionByRequest(requestId);
      if (data?.source === "provider_issued" && data.prescriptionImage) {
        setPrescription(data);
      } else {
        setPrescription(null);
      }
    } catch {
      setPrescription(null);
    } finally {
      setLoading(false);
    }
  }, [enabled, requestId, requestStatus]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!enabled || !VISIBLE_STATUSES.has(requestStatus)) {
    return null;
  }

  if (loading) {
    return (
      <View style={[styles.card, compact && styles.cardCompact]}>
        <ActivityIndicator size="small" color={AUTH_COLORS.green} />
      </View>
    );
  }

  if (!prescription?.prescriptionImage) {
    return null;
  }

  const viewerUrl = buildBackendAssetUrl(
    "images",
    prescription.prescriptionImage,
  );

  const openViewer = () => {
    if (!viewerUrl) {
      Alert.alert("Unavailable", "Could not open the prescription file.");
      return;
    }
    setViewerVisible(true);
  };

  const handleDownload = async () => {
    if (!viewerUrl) {
      Alert.alert("Unavailable", "Could not download the prescription file.");
      return;
    }
    try {
      setDownloading(true);
      await downloadPrescriptionFile({
        url: viewerUrl,
        fileType: prescription.fileType,
        filenameHint: prescription.prescriptionImage,
      });
    } catch (error: any) {
      Alert.alert(
        "Download failed",
        error?.message || "Could not download the prescription.",
      );
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <View style={[styles.card, compact && styles.cardCompact]}>
        <View style={styles.row}>
          <Feather name="file-text" size={16} color={AUTH_COLORS.greenDark} />
          <View style={styles.textCol}>
            <Text style={styles.title}>Your prescription</Text>
            <Text style={styles.meta}>
              Issued by your healthcare provider
              {prescription.fileType === "pdf" ? " (PDF)" : " (image)"}
            </Text>
          </View>
        </View>
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={openViewer}
            activeOpacity={0.85}
          >
            <Feather name="eye" size={15} color={AUTH_COLORS.greenDark} />
            <Text style={styles.secondaryBtnText}>View</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.btn}
            onPress={() => void handleDownload()}
            disabled={downloading}
            activeOpacity={0.85}
          >
            {downloading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="download" size={15} color="#fff" />
                <Text style={styles.btnText}>Download</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <PrescriptionViewerModal
        visible={viewerVisible}
        url={viewerUrl}
        fileType={prescription.fileType}
        title="Your prescription"
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
    backgroundColor: AUTH_COLORS.greenSoft,
  },
  cardCompact: {
    marginTop: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 12,
  },
  textCol: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: "800",
    color: AUTH_COLORS.textDark,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    color: AUTH_COLORS.textMuted,
    lineHeight: 17,
  },
  actions: {
    flexDirection: "row",
    gap: 10,
  },
  btn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: AUTH_COLORS.error,
    paddingVertical: 12,
    borderRadius: 12,
  },
  btnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: AUTH_COLORS.white,
    borderWidth: 1.5,
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
