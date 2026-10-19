// Signs release builds with the Google Play upload key. The keystore and its passwords stay
// outside the repo, in ~/.gradle/gradle.properties (MARTLY_UPLOAD_*; backup in
// Dropbox/Certificates/martly). Machines without the key keep signing release with the debug key.
const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_CONFIG = `
        release {
            if (findProperty('MARTLY_UPLOAD_STORE_FILE')) {
                storeFile file(findProperty('MARTLY_UPLOAD_STORE_FILE'))
                storePassword findProperty('MARTLY_UPLOAD_STORE_PASSWORD')
                keyAlias findProperty('MARTLY_UPLOAD_KEY_ALIAS')
                keyPassword findProperty('MARTLY_UPLOAD_KEY_PASSWORD')
            }
        }`;

const RELEASE_SIGNING = "signingConfig findProperty('MARTLY_UPLOAD_STORE_FILE') ? signingConfigs.release : signingConfigs.debug";

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let gradle = mod.modResults.contents;
    if (gradle.includes("MARTLY_UPLOAD_STORE_FILE")) return mod;

    gradle = gradle.replace(/(signingConfigs \{\n\s+debug \{[^}]*\})/, `$1${RELEASE_CONFIG}`);
    gradle = gradle.replace(/(release \{\n(?:\s+\/\/.*\n)*\s+)signingConfig signingConfigs\.debug/, `$1${RELEASE_SIGNING}`);
    if (!gradle.includes(RELEASE_SIGNING)) throw new Error("with-release-signing: app/build.gradle layout changed");

    mod.modResults.contents = gradle;
    return mod;
  });
};
