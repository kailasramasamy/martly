import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { activeLocale } from "./i18n";

// Native text-to-speech arrives with a new app build; older builds and Expo Go hide the read-aloud button
let Speech: typeof import("expo-speech") | null = null;
let Recognition: typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule | null = null;
try {
  Speech = require("expo-speech");
  Recognition = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
} catch {
  // Build without expo-speech
}

// Listening leaves iOS recording in "measurement" mode, where speech plays faintly; read through the loudspeaker
function routeToLoudspeaker() {
  if (Platform.OS === "ios") Recognition?.setCategoryIOS({ category: "playback", categoryOptions: ["duckOthers"], mode: "spokenAudio" });
}

/**
 * Reads text aloud in the app language. `available` is false when the phone has no voice for that language
 * (many Android phones ship without a Tamil voice), so the caller can hide the button instead of reading Tamil badly.
 */
export function useReadAloud() {
  const locale = activeLocale();
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!Speech) return;
    const lang = locale.slice(0, 2);
    Speech.getAvailableVoicesAsync()
      .then((voices) => setAvailable(lang === "en" || voices.some((v) => v.language.toLowerCase().startsWith(lang))))
      .catch(() => setAvailable(false));
    return () => {
      Speech?.stop();
    };
  }, [locale]);

  const speak = useCallback((text: string) => {
    if (!Speech) return;
    Speech.stop();
    routeToLoudspeaker();
    setSpeaking(true);
    Speech.speak(text, {
      language: locale,
      rate: 0.9,
      onDone: () => setSpeaking(false),
      onStopped: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  }, [locale]);

  const stop = useCallback(() => {
    Speech?.stop();
    setSpeaking(false);
  }, []);

  return { available, speaking, speak, stop };
}
