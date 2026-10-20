import { useCallback, useState } from "react";
import { useToast } from "./toast-context";
import { useStrings } from "./i18n/use-strings";
import { activeLocale } from "./i18n";

// Native speech recognition is absent in Expo Go; callers hide voice UI when `available` is false
let SpeechModule: typeof import("expo-speech-recognition").ExpoSpeechRecognitionModule | null = null;
let useSpeechEvent: typeof import("expo-speech-recognition").useSpeechRecognitionEvent = () => {};
try {
  const mod = require("expo-speech-recognition");
  SpeechModule = mod.ExpoSpeechRecognitionModule;
  useSpeechEvent = mod.useSpeechRecognitionEvent;
} catch {
  // Expo Go — voice input unavailable
}

/**
 * One-shot dictation: streams the interim transcript to `onPartial` and hands the final
 * transcript to `onFinal`. Indian English so product names like "toor dal" are recognised.
 */
export function useVoiceInput(onPartial: (text: string) => void, onFinal: (text: string) => void) {
  const { show } = useToast();
  const t = useStrings("search");
  const [listening, setListening] = useState(false);

  useSpeechEvent("start", () => setListening(true));
  useSpeechEvent("end", () => setListening(false));
  useSpeechEvent("result", (event) => {
    const transcript = event.results[0]?.transcript.trim() ?? "";
    if (event.isFinal) {
      if (transcript) onFinal(transcript);
    } else {
      onPartial(transcript);
    }
  });
  useSpeechEvent("error", (event) => {
    setListening(false);
    if (event.error === "not-allowed") show(t.micDenied, "error");
    else if (event.error === "no-speech") show(t.didntCatch);
  });

  const start = useCallback(async () => {
    if (!SpeechModule) return;
    const { granted } = await SpeechModule.requestPermissionsAsync();
    if (!granted) {
      show(t.micDenied, "error");
      return;
    }
    // Listens in the app language, so a Tamil shopper can speak Tamil; search matches Tamil product names
    SpeechModule.start({ lang: activeLocale(), interimResults: true, continuous: false });
  }, [show, t]);

  const stop = useCallback(() => SpeechModule?.stop(), []);

  return { available: SpeechModule !== null, listening, start, stop };
}
