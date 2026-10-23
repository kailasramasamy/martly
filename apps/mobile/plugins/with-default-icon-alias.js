// The app icon follows the shopper's language (expo-alternate-app-icons, patched in /patches).
// Each icon gets its own launcher alias, the English one included, so a switch only toggles
// aliases and MainActivity stays enabled for deep links, notification taps and the UPI return
const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

const LAUNCHER = "android.intent.category.LAUNCHER";

const isLauncherFilter = (filter) =>
  (filter.category ?? []).some((category) => category.$["android:name"] === LAUNCHER);

module.exports = function withDefaultIconAlias(config) {
  return withAndroidManifest(config, (mod) => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(mod.modResults);
    const launcherFilter = mainActivity["intent-filter"].find(isLauncherFilter);
    mainActivity["intent-filter"] = mainActivity["intent-filter"].filter((filter) => filter !== launcherFilter);

    application["activity-alias"] = [
      {
        $: {
          "android:name": ".MainActivityDefault",
          "android:enabled": "true",
          "android:exported": "true",
          "android:icon": "@mipmap/ic_launcher",
          "android:roundIcon": "@mipmap/ic_launcher_round",
          "android:targetActivity": ".MainActivity",
        },
        "intent-filter": [launcherFilter],
      },
      ...(application["activity-alias"] ?? []),
    ];
    return mod;
  });
};
