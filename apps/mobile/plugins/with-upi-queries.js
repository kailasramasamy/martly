// Android 11+ hides other apps unless the manifest declares them; without this the UPI apps
// (Google Pay, PhonePe, Paytm…) are invisible to Razorpay and to our own payment picker
const { withAndroidManifest } = require("expo/config-plugins");

const UPI_PACKAGES = ["com.google.android.apps.nbu.paisa.user", "com.phonepe.app", "net.one97.paytm"];

const isUpiQuery = (query) =>
  (query.intent ?? []).some((intent) => (intent.data ?? []).some((data) => data.$["android:scheme"] === "upi"));

module.exports = function withUpiQueries(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    // prebuild reuses an existing android/, so replace the block an earlier run added
    manifest.queries = [
      ...(manifest.queries ?? []).filter((query) => !isUpiQuery(query)),
      {
        package: UPI_PACKAGES.map((name) => ({ $: { "android:name": name } })),
        intent: [{
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          data: [{ $: { "android:scheme": "upi" } }],
        }],
      },
    ];
    return mod;
  });
};
