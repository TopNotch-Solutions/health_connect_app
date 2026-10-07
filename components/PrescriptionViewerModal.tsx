/**
 * In-app popup to view a prescription image or PDF.
 */

import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { AUTH_COLORS } from "../lib/authScreenTheme";

type Props = {
  visible: boolean;
  url: string | null;
  fileType?: "image" | "pdf" | null;
  title?: string;
  onClose: () => void;
};

export default function PrescriptionViewerModal({
  visible,
  url,
  fileType = "image",
  title = "Prescription",
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (visible) {
      setLoading(true);
    }
  }, [visible, url]);

  const isPdf = fileType === "pdf";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.header,
            { paddingTop: Math.max(insets.top, 12) + 4 },
          ]}
        >
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <TouchableOpacity
            onPress={onClose}
            style={styles.closeBtn}
            hitSlop={12}
            activeOpacity={0.85}
          >
            <Feather name="x" size={22} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {!url ? (
            <Text style={styles.emptyText}>No file to display.</Text>
          ) : isPdf ? (
            <>
              {loading ? (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color={AUTH_COLORS.green} />
                  <Text style={styles.loaderText}>Loading PDF…</Text>
                </View>
              ) : null}
              <WebView
                source={{ uri: url }}
                style={styles.webview}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => setLoading(false)}
                startInLoadingState
                scalesPageToFit
                allowsFullscreenVideo={false}
              />
            </>
          ) : (
            <TouchableOpacity
              style={styles.imageWrap}
              activeOpacity={1}
              onPress={onClose}
            >
              <Image
                source={{ uri: url }}
                style={styles.image}
                resizeMode="contain"
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
              />
              {loading ? (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color={AUTH_COLORS.green} />
                </View>
              ) : null}
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.hint, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {isPdf ? "Swipe or pinch to zoom · tap × to close" : "Tap image or × to close"}
        </Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.96)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  title: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
    marginRight: 12,
  },
  closeBtn: {
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    padding: 10,
  },
  body: {
    flex: 1,
    justifyContent: "center",
  },
  imageWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  webview: {
    flex: 1,
    backgroundColor: "#111",
  },
  loader: {
    ...StyleSheet.absoluteFill,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2,
  },
  loaderText: {
    marginTop: 10,
    color: "#D1D5DB",
    fontSize: 13,
  },
  emptyText: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 14,
  },
  hint: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
    paddingTop: 8,
  },
});
