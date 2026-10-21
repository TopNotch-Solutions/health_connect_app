const { withAndroidManifest } = require("expo/config-plugins");

// expo-screen-capture declares READ_MEDIA_IMAGES so that addScreenshotListener()
// can read the captured image on Android 14. We never call that API - only
// preventScreenCaptureAsync() and the app-switcher protection - so the permission
// is never exercised. Leaving it in the merged manifest triggers Google Play's
// "Photo and video permissions" declaration, which we cannot honestly complete.
// Strip it at manifest-merge time.
//
// Do NOT inject Activity FLAG_SECURE here. A permanent FLAG_SECURE blanks
// WebRTC / Stream video tiles. Screenshot blocking is done via
// expo-screen-capture so teleconsultation can pause it for the call.
const STRIPPED_PERMISSIONS = ["android.permission.READ_MEDIA_IMAGES"];

function withStrippedMediaPermissions(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;

    manifest.$ = manifest.$ || {};
    manifest.$["xmlns:tools"] =
      manifest.$["xmlns:tools"] || "http://schemas.android.com/tools";

    const permissions = manifest["uses-permission"] || [];

    for (const name of STRIPPED_PERMISSIONS) {
      const existing = permissions.find(
        (entry) => entry.$ && entry.$["android:name"] === name,
      );

      if (existing) {
        // A bare tools:node="remove" must not carry SDK bounds, or the merger
        // scopes the removal instead of applying it outright.
        delete existing.$["android:minSdkVersion"];
        delete existing.$["android:maxSdkVersion"];
        existing.$["tools:node"] = "remove";
      } else {
        permissions.push({
          $: { "android:name": name, "tools:node": "remove" },
        });
      }
    }

    manifest["uses-permission"] = permissions;

    return config;
  });
}

module.exports = function withPreventScreenshots(config) {
  return withStrippedMediaPermissions(config);
};
