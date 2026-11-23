// ML Kit's barcode delegate activity is locked to portrait, which makes Play treat a portrait screen as required
// and hide the app from tablets, desktops and XR. Declaring the feature optional keeps them installable.
const { withAndroidManifest } = require("expo/config-plugins");

const FEATURE = "android.hardware.screen.portrait";

module.exports = function withOptionalPortrait(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    // prebuild reuses an existing android/, so replace the entry an earlier run added
    manifest["uses-feature"] = [
      ...(manifest["uses-feature"] ?? []).filter((feature) => feature.$["android:name"] !== FEATURE),
      { $: { "android:name": FEATURE, "android:required": "false" } },
    ];
    return mod;
  });
};
