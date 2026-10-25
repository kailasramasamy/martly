import { useCallback, useEffect, useRef, useState } from "react";
import { Animated } from "react-native";
import { SPEECH_MAX_SECONDS } from "@martly/shared/constants";
import type { SpeechTranscript } from "@martly/shared/types";
import { api, ApiError } from "./api";
import { activeLanguage } from "./i18n";
import { useStrings } from "./i18n/use-strings";
import { useToast } from "./toast-context";
import { useVoiceInput } from "./use-voice-input";

// Native audio recording arrives with a new app build; older builds use the phone's recogniser only
let Audio: typeof import("expo-audio") | null = null;
try {
  Audio = require("expo-audio");
} catch {
  // Build without expo-audio
}

// Silence after speech that ends one item, and how often the level is read
const PAUSE_MS = 1200;
const TICK_MS = 100;
// Louder than the room by this much (dB) counts as speech, so a noisy shop still cuts at pauses
const SPEECH_OVER_FLOOR_DB = 12;
const SPEECH_MIN_DB = -50;

// Small mono AAC: a 2-3 second item is about 10 KB to upload
const CLIP_OPTIONS = Audio && {
  extension: ".m4a",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  isMeteringEnabled: true,
  android: { outputFormat: "mpeg4", audioEncoder: "aac" },
  ios: { outputFormat: Audio.IOSOutputFormat.MPEG4AAC, audioQuality: Audio.AudioQuality.MEDIUM },
  web: {},
} as import("expo-audio").RecordingOptions;

type Recorder = import("expo-audio").AudioRecorder;

interface Clip {
  /** The room's quiet level, rising slowly so it follows a noisier room */
  floorDb: number;
  heard: boolean;
  lastVoiceAt: number;
}

/** Reads one level sample: whether the item is over (a pause after speech, or too long) and how loud it is (0-1) */
function readLevel(clip: Clip, db: number, durationMs: number) {
  clip.floorDb = Math.min(db, clip.floorDb + 0.05);
  const now = Date.now();
  if (db > Math.max(clip.floorDb + SPEECH_OVER_FLOOR_DB, SPEECH_MIN_DB)) {
    clip.heard = true;
    clip.lastVoiceAt = now;
  }
  const paused = clip.heard && now - clip.lastVoiceAt > PAUSE_MS;
  const level = Math.max(0, Math.min(1, (db - clip.floorDb) / 30));
  return { over: paused || durationMs > SPEECH_MAX_SECONDS * 1000, level };
}

/** Sends clips for transcription and hands their text over in the order they were spoken */
function useClipQueue(storeId: string | undefined, purpose: VoicePurpose, onFinal: (text: string) => void, onFail: (err: unknown) => void) {
  const [pending, setPending] = useState(0);
  const queue = useRef<{ done: boolean; text: string }[]>([]);

  const flush = useCallback(() => {
    while (queue.current[0]?.done) {
      const { text } = queue.current.shift()!;
      if (text) onFinal(text);
    }
  }, [onFinal]);

  const send = useCallback(async (uri: string) => {
    const slot = { done: false, text: "" };
    queue.current.push(slot);
    setPending((n) => n + 1);
    const form = new FormData();
    form.append("storeId", storeId ?? "");
    form.append("language", activeLanguage() ?? "en");
    form.append("purpose", purpose);
    form.append("file", { uri, name: "item.m4a", type: "audio/mp4" } as unknown as Blob);
    try {
      slot.text = (await api.upload<SpeechTranscript>("/api/v1/speech/transcribe", form)).data.text;
    } catch (err) {
      onFail(err);
    }
    slot.done = true;
    setPending((n) => n - 1);
    flush();
  }, [storeId, purpose, flush, onFail]);

  return { pending, send };
}

/** Records item after item, cutting a clip at each pause; `onClip` gets each clip that had speech in it */
function useClipRecorder(continuous: boolean, onClip: (uri: string) => void) {
  const recorder = Audio!.useAudioRecorder(CLIP_OPTIONS!);
  const [listening, setListening] = useState(false);
  const level = useRef(new Animated.Value(0)).current;
  // `recording` is tracked here, not read from the recorder: once the screen closes the native recorder is released
  // and reading it throws, so `gone` stops every later call
  const run = useRef({ on: false, recording: false, gone: false, cutting: null as Promise<void> | null, clip: { floorDb: 0, heard: false, lastVoiceAt: 0 } as Clip });
  useEffect(() => () => {
    Object.assign(run.current, { on: false, gone: true });
  }, []);

  const begin = useCallback(async (r: Recorder) => {
    run.current.clip = { floorDb: 0, heard: false, lastVoiceAt: 0 };
    await r.prepareToRecordAsync();
    if (run.current.gone) return;
    r.record();
    run.current.recording = true;
  }, []);

  // Ends the clip in hand; the cut falls in the shopper's pause, so restarting clips no words. Stopping for good
  // hands the phone back to playback, so read-aloud is loud again
  const cut = useCallback(() => {
    const s = run.current;
    s.cutting = (async () => {
      await recorder.stop();
      s.recording = false;
      if (s.gone) return;
      if (s.clip.heard && recorder.uri) onClip(recorder.uri);
      if (s.on) await begin(recorder);
      else await Audio!.setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      s.cutting = null;
    })();
    return s.cutting;
  }, [recorder, begin, onClip]);

  useEffect(() => {
    if (!listening) return;
    const timer = setInterval(() => {
      const s = run.current;
      if (!s.on || s.cutting) return;
      const status = recorder.getStatus();
      const { over, level: now } = readLevel(s.clip, status.metering ?? -160, status.durationMillis);
      level.setValue(now);
      if (!over) return;
      // One item at a time ends after it; a clip with no speech is dropped and listening goes on
      if (!continuous && s.clip.heard) {
        s.on = false;
        setListening(false);
      }
      cut();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [listening, continuous, recorder, level, cut]);

  return { recorder, listening, setListening, level, run, begin, cut };
}

type ClipRecorder = ReturnType<typeof useClipRecorder>;

/** Starts and stops the recorder, and switches a session to the phone's recogniser when the API can't transcribe */
function useRecorderControls(recorder: ClipRecorder, deviceStart: () => void) {
  const { show } = useToast();
  const t = useStrings("search");
  const [failed, setFailed] = useState(false);

  const start = useCallback(async () => {
    const { granted } = await Audio!.requestRecordingPermissionsAsync();
    if (!granted) return show(t.micDenied, "error");
    await Audio!.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    recorder.run.current.on = true;
    await recorder.begin(recorder.recorder);
    recorder.setListening(true);
  }, [recorder, show, t]);

  // What was said before Done still counts. Resolves once the last clip is handed to the queue
  const stop = useCallback(async () => {
    const s = recorder.run.current;
    if (!s.on) return;
    s.on = false;
    recorder.setListening(false);
    // A cut under way may already have started the next clip
    await s.cutting;
    if (s.recording && !s.gone) await recorder.cut();
  }, [recorder]);

  const onFail = useCallback((err: unknown) => {
    if (err instanceof ApiError && err.status === 429) return show(t.voiceBusy, "error");
    if (err instanceof ApiError && err.status === 400) return show(t.didntCatch);
    // Voice off on the server, the provider down, or no network: carry on with the phone's recogniser
    const wasOn = recorder.run.current.on;
    setFailed(true);
    show(t.voiceDevice);
    if (wasOn) stop().then(deviceStart);
  }, [recorder, show, t, stop, deviceStart]);

  return { failed, start, stop, onFail };
}

// "list": shopping-list items in the store's language; "post": an owner's post, English or Tamil written as spoken
type VoicePurpose = "list" | "post";
type VoiceOptions = { storeId?: string; continuous?: boolean; hints?: string[]; purpose?: VoicePurpose };

function useRecordedVoice(onPartial: (text: string) => void, onFinal: (text: string) => void, options: VoiceOptions) {
  const device = useVoiceInput(onPartial, onFinal, options);
  // The queue reports failures to the controls, which need the recorder the queue feeds
  const fail = useRef<(err: unknown) => void>(() => {});
  const queue = useClipQueue(options.storeId, options.purpose ?? "list", onFinal, useCallback((err: unknown) => fail.current(err), []));
  const recorder = useClipRecorder(options.continuous ?? false, queue.send);
  const controls = useRecorderControls(recorder, device.start);
  fail.current = controls.onFail;

  if (controls.failed || !options.storeId) return { ...device, level: null, pending: 0 };
  const { start, stop } = controls;
  return { available: true, listening: recorder.listening, start, stop, level: recorder.level, pending: queue.pending };
}

function useDeviceVoice(onPartial: (text: string) => void, onFinal: (text: string) => void, options: VoiceOptions) {
  return { ...useVoiceInput(onPartial, onFinal, options), level: null as Animated.Value | null, pending: 0 };
}

/**
 * Voice for shopping lists: each item is recorded on the phone and transcribed by our API (Sarvam), which hears
 * Tamil, English and both mixed, whatever the app language. `continuous` keeps going item after item until `stop`.
 * If the API can't transcribe, the session switches to the phone's own recogniser (with `hints`). Same shape as
 * `useVoiceInput`, plus the live `level` (0-1) and how many spoken items are still being written (`pending`).
 */
export const useCloudVoice = Audio ? useRecordedVoice : useDeviceVoice;
