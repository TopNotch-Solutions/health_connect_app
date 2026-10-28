/**
 * In-app popup to view a prescription image or PDF.
 * Use `embedded` when already inside another RN Modal (e.g. ProfileFeatureShell)
 * so a second native Modal is not required.
 *
 * PDFs are rendered with PDF.js inside a WebView so Android never opens a
 * system download / share sheet.
 */

import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
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
import {
  attachAuthToAssetUrl,
  type AuthenticatedAssetSource,
} from "../lib/backend";

type Props = {
  visible: boolean;
  url: string | null;
  fileType?: "image" | "pdf" | null;
  title?: string;
  onClose: () => void;
  /** Render as absolute overlay instead of a nested native Modal. */
  embedded?: boolean;
};

function buildPdfJsHtml(base64: string): string {
  // Base64 alphabet has no quotes/backslashes, so embedding is safe.
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4" />
  <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
  <style>
    html, body { margin: 0; padding: 0; background: #111; }
    #viewer {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px;
      min-height: 100vh;
    }
    canvas {
      width: 100% !important;
      height: auto !important;
      background: #fff;
      border-radius: 4px;
    }
    .err {
      color: #D1D5DB;
      text-align: center;
      padding: 32px 16px;
      font-family: -apple-system, sans-serif;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="viewer"><p class="err">Loading PDF…</p></div>
  <script>
    (function () {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      var viewer = document.getElementById("viewer");
      try {
        var raw = atob("${base64}");
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
          viewer.innerHTML = "";
          var chain = Promise.resolve();
          for (var pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            (function (n) {
              chain = chain.then(function () {
                return pdf.getPage(n).then(function (page) {
                  var scale = 1.5;
                  var viewport = page.getViewport({ scale: scale });
                  var canvas = document.createElement("canvas");
                  var ctx = canvas.getContext("2d");
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  viewer.appendChild(canvas);
                  return page.render({ canvasContext: ctx, viewport: viewport }).promise;
                });
              });
            })(pageNum);
          }
          return chain;
        }).catch(function () {
          viewer.innerHTML = '<p class="err">Could not display this PDF.</p>';
        });
      } catch (e) {
        viewer.innerHTML = '<p class="err">Could not display this PDF.</p>';
      }
    })();
  </script>
</body>
</html>`;
}

export default function PrescriptionViewerModal({
  visible,
  url,
  fileType = "image",
  title = "Prescription",
  onClose,
  embedded = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [authSource, setAuthSource] =
    React.useState<AuthenticatedAssetSource | null>(null);
  const [pdfHtml, setPdfHtml] = React.useState<string | null>(null);

  const isPdf = fileType === "pdf";
  const isLocalUri = (value: string) =>
    value.startsWith("file:") || value.startsWith("content:");

  React.useEffect(() => {
    let cancelled = false;

    if (!visible || !url) {
      setAuthSource(null);
      setPdfHtml(null);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setPdfHtml(null);
    setAuthSource(null);

    (async () => {
      try {
        if (isPdf) {
          let localPath = url;

          if (!isLocalUri(url)) {
            const auth = await attachAuthToAssetUrl(url);
            const targetUri = `${FileSystem.cacheDirectory}doc_preview_${Date.now()}.pdf`;
            const result = await FileSystem.downloadAsync(auth.uri, targetUri, {
              headers: auth.headers,
            });
            if (cancelled) return;
            if (result.status !== 200) {
              setError("Could not load this PDF.");
              setLoading(false);
              return;
            }
            localPath = result.uri;
          }

          const base64 = await FileSystem.readAsStringAsync(localPath, {
            encoding: FileSystem.EncodingType.Base64,
          });
          if (cancelled) return;

          setPdfHtml(buildPdfJsHtml(base64));
          setLoading(false);
          return;
        }

        const source = await attachAuthToAssetUrl(url);
        if (!cancelled) {
          setAuthSource(source);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load this document.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, url, isPdf]);

  if (embedded && !visible) return null;

  const body = (
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
        {error ? (
          <View style={styles.loader}>
            <Text style={styles.emptyText}>{error}</Text>
          </View>
        ) : isPdf ? (
          <>
            {loading || !pdfHtml ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={AUTH_COLORS.green} />
                <Text style={styles.loaderText}>Loading PDF…</Text>
              </View>
            ) : (
              <WebView
                source={{ html: pdfHtml, baseUrl: "https://localhost" }}
                style={styles.webview}
                onLoadStart={() => setLoading(true)}
                onLoadEnd={() => setLoading(false)}
                onError={() => {
                  setLoading(false);
                  setError("Could not display this PDF.");
                }}
                // Never hand PDFs off to the system downloader.
                onFileDownload={() => {}}
                setSupportMultipleWindows={false}
                javaScriptEnabled
                originWhitelist={["*"]}
                allowFileAccess
                mixedContentMode="always"
                startInLoadingState
              />
            )}
          </>
        ) : !url || !authSource ? (
          <View style={styles.loader}>
            {url ? (
              <>
                <ActivityIndicator size="large" color={AUTH_COLORS.green} />
                <Text style={styles.loaderText}>Loading…</Text>
              </>
            ) : (
              <Text style={styles.emptyText}>No file to display.</Text>
            )}
          </View>
        ) : (
          <TouchableOpacity
            style={styles.imageWrap}
            activeOpacity={1}
            onPress={onClose}
          >
            <Image
              source={{
                uri: authSource.uri,
                headers: authSource.headers,
              }}
              style={styles.image}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => setLoading(false)}
            />
            {loading ? (
              <View style={styles.loader}>
                <ActivityIndicator size="large" color={AUTH_COLORS.green} />
              </View>
            ) : null}
          </TouchableOpacity>
        )}
      </View>

      <Text
        style={[styles.hint, { paddingBottom: Math.max(insets.bottom, 16) }]}
      >
        {isPdf
          ? "Scroll to browse pages · tap × to close"
          : "Tap image or × to close"}
      </Text>
    </View>
  );

  if (embedded) {
    return <View style={styles.embeddedRoot}>{body}</View>;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      {body}
    </Modal>
  );
}

const styles = StyleSheet.create({
  embeddedRoot: {
    ...StyleSheet.absoluteFill,
    zIndex: 100,
    elevation: 100,
  },
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
    paddingHorizontal: 24,
  },
  hint: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
    paddingTop: 8,
  },
});
