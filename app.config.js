/**
 * Dynamic config layer over app.json.
 *
 * Google Maps keys are sourced from the environment so that a rotated key
 * never has to be committed. The literal values still in app.json act as
 * fallbacks, so builds keep working until the env vars are set everywhere
 * (locally in .env, and as EAS secrets for cloud builds).
 *
 * These variables are deliberately NOT prefixed with EXPO_PUBLIC_. They
 * configure the native build only and must never be inlined into the JS
 * bundle. The JS-side Directions key is separate — see lib/googleMaps.ts.
 *
 * Two distinct keys are expected:
 *
 *   GOOGLE_MAPS_ANDROID_KEY  — Maps SDK for Android. Restrict by package name
 *                              + release SHA-1, and to the Maps SDK only.
 *   GOOGLE_MAPS_IOS_KEY      — Maps SDK for iOS. Restrict by bundle ID.
 *
 * The Directions API cannot be restricted by app signature, because those are
 * plain HTTPS calls that carry no attestation. It needs its own key.
 */
module.exports = ({ config }) => {
  const androidMapsKey =
    process.env.GOOGLE_MAPS_ANDROID_KEY ||
    config.android?.config?.googleMaps?.apiKey;

  // Falls back to the Android key so iOS Google Maps can render when used.
  // Apple Maps (default on iOS in JS) does not need this key.
  const iosMapsKey = process.env.GOOGLE_MAPS_IOS_KEY || androidMapsKey;

  let hasMapsPlugin = false;
  const plugins = (config.plugins || []).map((plugin) => {
    if (Array.isArray(plugin) && plugin[0] === "react-native-maps") {
      hasMapsPlugin = true;
      return [
        "react-native-maps",
        {
          ...(plugin[1] || {}),
          androidGoogleMapsApiKey: androidMapsKey,
          iosGoogleMapsApiKey: iosMapsKey,
        },
      ];
    }
    if (plugin === "react-native-maps") {
      hasMapsPlugin = true;
      return [
        "react-native-maps",
        {
          androidGoogleMapsApiKey: androidMapsKey,
          iosGoogleMapsApiKey: iosMapsKey,
        },
      ];
    }
    return plugin;
  });

  // Required on Expo SDK 53+ — without this plugin iOS maps often stay blank.
  if (!hasMapsPlugin) {
    plugins.push([
      "react-native-maps",
      {
        androidGoogleMapsApiKey: androidMapsKey,
        iosGoogleMapsApiKey: iosMapsKey,
      },
    ]);
  }

  return {
    ...config,
    ios: {
      ...config.ios,
      config: {
        ...config.ios?.config,
        googleMapsApiKey: iosMapsKey,
      },
    },
    android: {
      ...config.android,
      config: {
        ...config.android?.config,
        googleMaps: {
          ...config.android?.config?.googleMaps,
          apiKey: androidMapsKey,
        },
      },
    },
    plugins,
  };
};
