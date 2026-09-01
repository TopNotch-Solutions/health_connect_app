const {
  withAndroidManifest,
  withDangerousMod,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SECURE_FLAG =
  "window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)";

// expo-screen-capture declares READ_MEDIA_IMAGES so that addScreenshotListener()
// can read the captured image on Android 14. We never call that API - only
// preventScreenCaptureAsync() and the app-switcher protection - so the permission
// is never exercised. Leaving it in the merged manifest triggers Google Play's
// "Photo and video permissions" declaration, which we cannot honestly complete.
// Strip it at manifest-merge time.
const STRIPPED_PERMISSIONS = ["android.permission.READ_MEDIA_IMAGES"];

function addPreventScreenshotsToMainActivity(contents) {
  let source = contents;

  if (!source.includes("import android.view.WindowManager")) {
    if (source.includes("import android.os.Bundle")) {
      source = source.replace(
        /import android\.os\.Bundle\r?\n/,
        (match) => `${match}import android.view.WindowManager\n`,
      );
    } else {
      source = source.replace(
        /package .+\r?\n/,
        (match) => `${match}import android.view.WindowManager\n`,
      );
    }
  }

  if (source.includes("WindowManager.LayoutParams.FLAG_SECURE")) {
    return source;
  }

  const updatedSource = source.replace(
    /(\n\s*)super\.onCreate\((null|savedInstanceState)\)/,
    `$1// Prevent screenshots and screen recording on Android.$1${SECURE_FLAG}$1$1super.onCreate($2)`,
  );

  if (updatedSource === source) {
    throw new Error(
      "withPreventScreenshots could not find MainActivity.onCreate",
    );
  }

  return updatedSource;
}

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

function withMainActivitySecureFlag(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      // PLATFORM GUARD: Skip processing completely if we are running an iOS compilation track
      if (config.modRequest.platform !== "android") {
        return config;
      }

      const packageName = config.android?.package;

      if (!packageName) {
        throw new Error(
          "withPreventScreenshots requires expo.android.package in app.json",
        );
      }

      const mainActivityPath = path.join(
        config.modRequest.platformProjectRoot,
        "app/src/main/java",
        ...packageName.split("."),
        "MainActivity.kt",
      );

      // Verify file existence explicitly before trying to read it
      if (!fs.existsSync(mainActivityPath)) {
        return config;
      }

      const contents = fs.readFileSync(mainActivityPath, "utf8");
      const updatedContents = addPreventScreenshotsToMainActivity(contents);

      if (updatedContents !== contents) {
        fs.writeFileSync(mainActivityPath, updatedContents, "utf8");
      }

      return config;
    },
  ]);
};

module.exports = function withPreventScreenshots(config) {
  return withStrippedMediaPermissions(withMainActivitySecureFlag(config));
};
