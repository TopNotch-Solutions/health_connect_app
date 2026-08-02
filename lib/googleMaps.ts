/**
 * Single source for the Google Maps key used from JavaScript (Directions API,
 * route rendering, ETA calculation).
 *
 * The key was previously hardcoded in three components, which meant rotating it
 * required finding every copy — and missing one would break maps in a way that
 * looks unrelated to the rotation. Keep it here.
 *
 * Note the native Maps SDK reads its own copy from app.json / AndroidManifest.
 * Rotating the key means changing both this env var and that one.
 *
 * This value is embedded in the app bundle, which is unavoidable for a
 * client-side Maps key and is expected by Google. The protection is
 * restriction, not secrecy: lock the key to the Android package name and the
 * release signing SHA-1 in Google Cloud Console so an extracted copy cannot be
 * used elsewhere.
 */
export const GOOGLE_MAPS_API_KEY =
  process.env.EXPO_PUBLIC_DIRECTIONS_API_KEY ?? "";

if (!GOOGLE_MAPS_API_KEY) {
  console.warn(
    "[maps] EXPO_PUBLIC_DIRECTIONS_API_KEY is not set — directions, ETAs and route rendering will fail.",
  );
}
