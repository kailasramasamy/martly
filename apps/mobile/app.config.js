// The Google Maps key is built into the native app; it comes from the environment
// (apps/mobile/.env locally, a build secret in CI) so it never lands in git
const mapsKey = process.env.GOOGLE_MAPS_APP_KEY;

if (!mapsKey) console.warn("GOOGLE_MAPS_APP_KEY is not set: Android maps will be blank in this build");

module.exports = ({ config }) => ({
  ...config,
  android: { ...config.android, config: { ...config.android?.config, googleMaps: { apiKey: mapsKey } } },
  ios: { ...config.ios, config: { ...config.ios?.config, googleMapsApiKey: mapsKey } },
});
