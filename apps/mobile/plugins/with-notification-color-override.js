// expo-notifications and @react-native-firebase/messaging both declare Firebase's default
// notification colour, which fails the Android manifest merge; keep ours (the brand teal)
const { withAndroidManifest } = require("expo/config-plugins");

const COLOR_KEY = "com.google.firebase.messaging.default_notification_color";

module.exports = function withNotificationColorOverride(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest.$["xmlns:tools"] = "http://schemas.android.com/tools";
    const entry = manifest.application[0]["meta-data"]?.find((m) => m.$["android:name"] === COLOR_KEY);
    if (entry) entry.$["tools:replace"] = "android:resource";
    return mod;
  });
};
