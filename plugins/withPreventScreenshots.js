const { withDangerousMod } = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const SECURE_FLAG =
  "window.setFlags(WindowManager.LayoutParams.FLAG_SECURE, WindowManager.LayoutParams.FLAG_SECURE)";

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

module.exports = function withPreventScreenshots(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
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

      const contents = fs.readFileSync(mainActivityPath, "utf8");
      const updatedContents = addPreventScreenshotsToMainActivity(contents);

      if (updatedContents !== contents) {
        fs.writeFileSync(mainActivityPath, updatedContents, "utf8");
      }

      return config;
    },
  ]);
};
