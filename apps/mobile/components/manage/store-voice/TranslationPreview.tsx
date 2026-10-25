import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { VoiceTranslations } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { api, ApiError } from "../../../lib/api";
import { TextField } from "../ui/TextField";

// Typing pauses this long before the words are translated
const SETTLE_MS = 1200;
const TAMIL = /[஀-௿]/;
const NAMES: Record<string, string> = { ta: "Tamil", en: "English" };

/** The other language of what's written: Tamil script gets English, anything else Tamil */
const otherOf = (text: string) => (TAMIL.test(text) ? "en" : "ta");

interface Preview {
  /** The words the translation was made from; when they change, it's made again unless the owner edited it */
  forText: string;
  text: string;
  edited: boolean;
}

/**
 * What shoppers in the other language will read, made while the owner writes (once typing or speech settles) and
 * theirs to correct. An edit starts from the post's saved translation
 */
export function useTranslationPreview(source: string, busy: boolean, saved?: VoiceTranslations | null) {
  const other = otherOf(source);
  const [preview, setPreview] = useState<Preview>(() => ({ forText: source.trim(), text: saved?.[other]?.text ?? "", edited: false }));
  const [loading, setLoading] = useState(false);
  const src = source.trim();

  const translate = useCallback(async (text: string) => {
    setLoading(true);
    try {
      const res = await api.post<{ translations: VoiceTranslations } | null>("/api/v1/store-voice/translate", { text });
      setPreview({ forText: text, text: res.data?.translations[otherOf(text)]?.text ?? "", edited: false });
    } catch (err) {
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      setPreview((p) => ({ ...p, forText: text }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!src || busy || preview.edited || src === preview.forText) return;
    const timer = setTimeout(() => void translate(src), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [src, busy, preview.edited, preview.forText, translate]);

  const edit = (text: string) => setPreview((p) => ({ ...p, text, edited: true }));
  const stale = preview.edited && src !== preview.forText;
  const translations = src && preview.text.trim() ? { [other]: { text: preview.text.trim() } } : undefined;
  return { other, text: preview.text, loading, stale, edit, again: () => void translate(src), translations };
}

type PreviewState = ReturnType<typeof useTranslationPreview>;

/** "Shoppers reading in Tamil see": the translation, editable, with Translate again once the post's words have moved on */
export function TranslationPreview({ preview, hasText }: { preview: PreviewState; hasText: boolean }) {
  if (!hasText) return null;
  const name = NAMES[preview.other];
  return (
    <View style={styles.box}>
      <View style={styles.head}>
        <Text style={styles.label}>{`SHOPPERS READING IN ${name.toUpperCase()} SEE`}</Text>
        {preview.loading && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
      <TextField
        value={preview.text} onChangeText={preview.edit} multiline maxLength={600}
        placeholder={preview.loading ? "Translating…" : `Write it in ${name}, or wait for the translation`}
        hint="Fix anything that doesn't sound right. Shoppers see exactly this."
      />
      {preview.stale && (
        <TouchableOpacity style={styles.again} onPress={preview.again} accessibilityRole="button">
          <Text style={styles.againText}>{`You changed the post. Translate again into ${name}`}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#f0fdfa", gap: 6 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 20 },
  label: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.5, color: "#115e59" },
  again: { minHeight: 44, justifyContent: "center" },
  againText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
