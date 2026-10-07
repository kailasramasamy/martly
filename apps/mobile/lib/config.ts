// API base URL, inlined at bundle time from EXPO_PUBLIC_API_URL:
//   development → apps/mobile/.env (your machine's LAN address)
//   release     → apps/mobile/.env.production (Railway)
// A release build without it would silently talk to nothing, so fail loudly instead.
const configured = process.env.EXPO_PUBLIC_API_URL;

if (!configured && !__DEV__) {
  throw new Error("EXPO_PUBLIC_API_URL is not set for this release build");
}

export const API_URL = configured ?? "http://localhost:7001";
