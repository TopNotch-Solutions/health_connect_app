/**
 * Full-screen document preview for the provider Edit Documents sheet.
 * Renders inside ProfileFeatureShell — modal only, never download/share.
 *
 * PDFs are fetched into the app cache, then rendered with PDF.js from a
 * local HTML file (avoids WebView inline-HTML size limits and system downloads).
 */

import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import React from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import { AUTH_COLORS } from "../lib/authScreenTheme";
import { attachAuthToAssetUrl, withAccessTokenQuery } from "../lib/backend";

export type EditDocumentPreview = {
  url: string;
  title: string;
  fileType: "image" | "pdf";
};

type Props = {
  preview: EditDocumentPreview | null;
  onClose: () => void;
};

function isLocalUri(value: string) {
  return (
    value.startsWith("file:") ||
    value.startsWith("content:") ||
    value.startsWith("data:")
  );
}

function buildPdfViewerHtml(base64: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4, user-scalable=yes" />
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
    .msg {
      color: #D1D5DB;
      text-align: center;
      padding: 32px 16px;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div id="viewer"><p class="msg">Rendering PDF…</p></div>
  <script>
    (function () {
      var viewer = document.getElementById("viewer");
      function fail(msg) {
        viewer.innerHTML = '<p class="msg">' + (msg || "Could not display this PDF.") + "</p>";
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "error", message: msg || "fail" }));
        }
      }
      function ready() {
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: "ready" }));
        }
      }
      if (typeof pdfjsLib === "undefined") {
        fail("PDF viewer failed to load. Check your internet connection.");
        return;
      }
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

      var b64 = ${JSON.stringify(base64)};
      try {
        var raw = atob(b64);
        var bytes = new Uint8Array(raw.length);
        for (var i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
        pdfjsLib.getDocument({ data: bytes }).promise.then(function (pdf) {
          viewer.innerHTML = "";
          var chain = Promise.resolve();
          for (var n = 1; n <= pdf.numPages; n++) {
            (function (pageNum) {
              chain = chain.then(function () {
                return pdf.getPage(pageNum).then(function (page) {
                  var viewport = page.getViewport({ scale: 1.4 });
                  var canvas = document.createElement("canvas");
                  var ctx = canvas.getContext("2d");
                  canvas.width = viewport.width;
                  canvas.height = viewport.height;
                  viewer.appendChild(canvas);
                  return page.render({ canvasContext: ctx, viewport: viewport }).promise;
                });
              });
            })(n);
          }
          return chain.then(ready);
        }).catch(function (err) {
          fail((err && err.message) ? String(err.message) : "Could not display this PDF.");
        });
      } catch (e) {
        fail((e && e.message) ? String(e.message) : "Could not display this PDF.");
      }
    })();
  </script>
</body>
</html>`;
}

async function resolveLocalPdfPath(url: string): Promise<string> {
  if (url.startsWith("file:")) return url;
  if (url.startsWith("content:")) {
    const dest = `${FileSystem.cacheDirectory}edit_doc_local_${Date.now()}.pdf`;
    await FileSystem.copyAsync({ from: url, to: dest });
    return dest;
  }
  throw new Error("Unsupported local PDF URI");
}

async function resolveRemotePdfPath(url: string): Promise<string> {
  const auth = await attachAuthToAssetUrl(url);
  const dest = `${FileSystem.cacheDirectory}edit_doc_remote_${Date.now()}.pdf`;
  const result = await FileSystem.downloadAsync(auth.uri, dest, {
    headers: auth.headers,
  });
  if (result.status !== 200) {
    // Fallback: try query-token URL (some stacks ignore custom headers).
    const authed = await withAccessTokenQuery(url);
    const retry = await FileSystem.downloadAsync(authed, dest);
    if (retry.status !== 200) {
      throw new Error("Could not download PDF for preview.");
    }
    return retry.uri;
  }
  return result.uri;
}

export default function EditDocumentPreviewOverlay({
  preview,
  onClose,
}: Props) {
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [imageUri, setImageUri] = React.useState<string | null>(null);
  const [viewerUri, setViewerUri] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    if (!preview?.url) {
      setLoading(false);
      setError(null);
      setImageUri(null);
      setViewerUri(null);
      return;
    }

    setLoading(true);
    setError(null);
    setImageUri(null);
    setViewerUri(null);

    (async () => {
      try {
        if (preview.fileType === "image") {
          if (isLocalUri(preview.url) || preview.url.includes("access_token=")) {
            if (!cancelled) {
              setImageUri(preview.url);
              setLoading(false);
            }
            return;
          }
          const auth = await attachAuthToAssetUrl(preview.url);
          if (cancelled) return;
          const sep = auth.uri.includes("?") ? "&" : "?";
          const tokenHeader = auth.headers?.["x-access-token"];
          const token =
            typeof tokenHeader === "string"
              ? tokenHeader.replace(/^Bearer\s+/i, "")
              : null;
          setImageUri(
            token
              ? `${auth.uri}${sep}access_token=${encodeURIComponent(token)}`
              : auth.uri,
          );
          setLoading(false);
          return;
        }

        // PDF → local file → base64 → HTML file → WebView (no system download UI)
        const pdfPath = isLocalUri(preview.url)
          ? await resolveLocalPdfPath(preview.url)
          : await resolveRemotePdfPath(preview.url);

        const base64 = await FileSystem.readAsStringAsync(pdfPath, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (cancelled) return;

        const html = buildPdfViewerHtml(base64);
        const htmlPath = `${FileSystem.cacheDirectory}edit_doc_viewer_${Date.now()}.html`;
        await FileSystem.writeAsStringAsync(htmlPath, html, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        if (cancelled) return;

        setViewerUri(htmlPath);
        setLoading(false);
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message || "Could not load this document.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [preview]);

  if (!preview) return null;

  // Explicit window size — absoluteFill + flex WebView often collapses to 0
  // height inside ProfileFeatureShell on Android.
  const headerPadTop = Math.max(insets.top, 12) + 4;
  const hintPadBottom = Math.max(insets.bottom, 16);
  const headerBlockHeight = headerPadTop + 52;
  const hintBlockHeight = hintPadBottom + 28;
  const contentHeight = Math.max(
    240,
    windowHeight - headerBlockHeight - hintBlockHeight,
  );

  return (
    <View style={[styles.root, { width: windowWidth, height: windowHeight }]}>
      <View style={[styles.header, { paddingTop: headerPadTop }]}>
        <Text style={styles.title} numberOfLines={1}>
          {preview.title}
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

      <View style={[styles.body, { height: contentHeight, width: windowWidth }]}>
        {error ? (
          <Text style={styles.emptyText}>{error}</Text>
        ) : loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={AUTH_COLORS.green} />
            <Text style={styles.loaderText}>Loading preview…</Text>
          </View>
        ) : preview.fileType === "image" && imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={{ width: windowWidth, height: contentHeight }}
            resizeMode="contain"
          />
        ) : preview.fileType === "pdf" && viewerUri ? (
          <WebView
            source={{ uri: viewerUri }}
            style={{
              width: windowWidth,
              height: contentHeight,
              backgroundColor: "#111",
            }}
            originWhitelist={["*"]}
            javaScriptEnabled
            domStorageEnabled
            mixedContentMode="always"
            allowFileAccess
            allowUniversalAccessFromFileURLs
            allowingReadAccessToURL={FileSystem.cacheDirectory || undefined}
            setSupportMultipleWindows={false}
            onFileDownload={() => {}}
            onMessage={(event) => {
              try {
                const data = JSON.parse(event.nativeEvent.data);
                if (data?.type === "error") {
                  setError(
                    typeof data.message === "string"
                      ? data.message
                      : "Could not display this PDF.",
                  );
                }
              } catch {
                // ignore
              }
            }}
            onError={() => setError("Could not display this PDF.")}
            startInLoadingState
            renderLoading={() => (
              <View
                style={[
                  styles.webviewLoader,
                  { width: windowWidth, height: contentHeight },
                ]}
              >
                <ActivityIndicator size="large" color={AUTH_COLORS.green} />
              </View>
            )}
          />
        ) : (
          <Text style={styles.emptyText}>No file to display.</Text>
        )}
      </View>

      <Text style={[styles.hint, { paddingBottom: hintPadBottom }]}>
        Tap × to close
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    zIndex: 100,
    elevation: 100,
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
    justifyContent: "center",
    overflow: "hidden",
  },
  webviewLoader: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#111",
  },
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
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
