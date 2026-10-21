import { useCallback, useRef, useState, type MutableRefObject } from "react";
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

// Silence that ends one item of a spoken list
const PAUSE_MS = 1500;

interface Options {
  /** Keep listening until `stop`, handing over one transcript per pause (for speaking a whole list) */
  continuous?: boolean;
  /** Words the recogniser should expect, e.g. grocery names it would otherwise mishear */
  hints?: string[];
}

interface Session {
  /** This hook started the running session; speech events are global */
  ours: boolean;
  /** Continuous mode: still wanted until the shopper taps Done */
  keepGoing: boolean;
  /** Audio time (ms into the session) up to which words were handed over as items */
  handedOverMs: number;
  /** Fallback when the recogniser gives no word timings: words of the transcript handed over */
  handedOverWords: number;
  pause: ReturnType<typeof setTimeout> | null;
}

type SpeechResult = import("expo-speech-recognition").ExpoSpeechRecognitionResult;

function clearPause(session: Session) {
  if (session.pause) clearTimeout(session.pause);
  session.pause = null;
}

/**
 * The words said since the last item handed over, and where they end. iOS keeps re-recognising earlier words as
 * the shopper talks ("1 kilo" becomes "1 kg"), so words are picked by when they were said, not by their position.
 */
function freshWords(s: Session, result: SpeechResult | undefined) {
  const timed = (result?.segments ?? []).filter((g) => g.endTimeMillis > 0);
  if (timed.length > 0) {
    const fresh = timed.filter((g) => g.startTimeMillis >= s.handedOverMs);
    return { text: fresh.map((g) => g.segment).join(" ").trim(), endMs: timed.at(-1)!.endTimeMillis, words: 0 };
  }
  const words = (result?.transcript ?? "").split(/\s+/).filter(Boolean);
  return { text: words.slice(s.handedOverWords).join(" "), endMs: 0, words: words.length };
}

/** Turns the recogniser's events into partial and final transcripts for the session this hook started */
function useSessionEvents(
  ref: MutableRefObject<Session>,
  begin: () => void,
  setListening: (on: boolean) => void,
  onPartial: (text: string) => void,
  onFinal: (text: string) => void,
  onError: (error: string) => void,
) {
  useSpeechEvent("start", () => {
    if (ref.current.ours) setListening(true);
  });
  useSpeechEvent("end", () => {
    const s = ref.current;
    if (!s.ours) return;
    clearPause(s);
    // The OS ended the session (Android before 13 does at every pause); listen again until Done
    if (s.keepGoing) return begin();
    s.ours = false;
    setListening(false);
  });
  useSpeechEvent("result", (event) => {
    const s = ref.current;
    if (!s.ours) return;
    // iOS grows one transcript for the whole session, so only the words after the last item are new
    const fresh = freshWords(s, event.results[0]);
    clearPause(s);
    if (event.isFinal) {
      if (fresh.text) onFinal(fresh.text);
      // After a final, the next transcript starts afresh
      Object.assign(s, { handedOverMs: 0, handedOverWords: 0 });
      return;
    }
    onPartial(fresh.text);
    if (s.keepGoing && fresh.text) {
      s.pause = setTimeout(() => {
        Object.assign(s, { handedOverMs: fresh.endMs, handedOverWords: fresh.words });
        onFinal(fresh.text);
      }, PAUSE_MS);
    }
  });
  useSpeechEvent("error", (event) => {
    const s = ref.current;
    if (!s.ours) return;
    // Silence between items is normal in a list; anything else stops listening
    if (s.keepGoing && event.error === "no-speech") return;
    s.keepGoing = false;
    setListening(false);
    onError(event.error);
  });
}

/**
 * Dictation: streams the interim transcript to `onPartial` and hands each final transcript to `onFinal`.
 * One-shot by default. In `continuous` mode the session keeps running (no restart, so no clipped words) and
 * each pause hands over the words spoken since the last item.
 */
export function useVoiceInput(onPartial: (text: string) => void, onFinal: (text: string) => void, { continuous = false, hints }: Options = {}) {
  const { show } = useToast();
  const t = useStrings("search");
  const [listening, setListening] = useState(false);
  const session = useRef<Session>({ ours: false, keepGoing: false, handedOverMs: 0, handedOverWords: 0, pause: null });

  // Listens in the app language, so a Tamil shopper can speak Tamil; search matches Tamil product names
  const begin = useCallback(() => {
    Object.assign(session.current, { handedOverMs: 0, handedOverWords: 0 });
    SpeechModule?.start({ lang: activeLocale(), interimResults: true, continuous, contextualStrings: hints });
  }, [continuous, hints]);

  useSessionEvents(session, begin, setListening, onPartial, onFinal, (error) => {
    if (error === "not-allowed") show(t.micDenied, "error");
    else if (error === "no-speech") show(t.didntCatch);
  });

  const start = useCallback(async () => {
    if (!SpeechModule) return;
    const { granted } = await SpeechModule.requestPermissionsAsync();
    if (!granted) return show(t.micDenied, "error");
    Object.assign(session.current, { ours: true, keepGoing: continuous });
    begin();
  }, [show, t, continuous, begin]);

  const stop = useCallback(() => {
    clearPause(session.current);
    session.current.keepGoing = false;
    SpeechModule?.stop();
  }, []);

  return { available: SpeechModule !== null, listening, start, stop };
}
