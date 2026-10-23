import { AppState, Platform, type AppStateStatus } from "react-native";
import { getAppIconName, setAlternateAppIcon, supportsAlternateIcons } from "expo-alternate-app-icons";

// Languages with their own home-screen icon (app.json → expo-alternate-app-icons); the rest keep English
const LANGUAGE_ICONS: Record<string, string> = { ta: "Tamil" };

function onAppState(target: AppStateStatus, run: () => void) {
  if (AppState.currentState === target) return run();
  const sub = AppState.addEventListener("change", (state) => {
    if (state !== target) return;
    sub.remove();
    run();
  });
}

/**
 * Match the home-screen icon to the language the shopper picked. Nothing is picked yet → leave it,
 * so a Tamil-locale phone doesn't get iOS's "icon changed" alert on first launch with no context.
 * Runs at launch (a switch into or out of Tamil restarts the app) and on switches that don't restart.
 */
export function syncAppIcon(pickedLanguage: string | null) {
  if (!pickedLanguage || !supportsAlternateIcons) return;
  const icon = LANGUAGE_ICONS[pickedLanguage] ?? null;
  if (getAppIconName() === icon) return;
  // iOS only switches while active; on Android, toggling the launcher alias while on screen can
  // close the app on some launchers, so it waits until the shopper leaves the app
  onAppState(Platform.OS === "ios" ? "active" : "background", () => setAlternateAppIcon(icon));
}
