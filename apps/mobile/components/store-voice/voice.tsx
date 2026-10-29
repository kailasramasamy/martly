import { useCallback, useState } from "react";
import { Image, StyleSheet, Text, View, type ViewStyle } from "react-native";
import type { VoiceTranslations } from "@martly/shared/types";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { formatDate, formatTime } from "../../lib/i18n/format";
import type { StorePost } from "../../lib/types";

type Voice = { text: string; language: string; translations: VoiceTranslations | null };

/** The owner's words in the app's language: as written, else the translation, else as written while it's on its way */
export function useVoiceText() {
  const { language } = useLanguage();
  const lang = language ?? "en";
  return useCallback((v: Voice) => (v.language === lang ? v.text : v.translations?.[lang]?.text ?? v.text), [lang]);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "Today, 7:40 am", "Yesterday", else the weekday ("Thursday") */
export function usePostTime() {
  const t = useStrings("storeVoice");
  return useCallback((iso: string) => {
    const at = new Date(iso);
    const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(at).setHours(0, 0, 0, 0)) / DAY_MS);
    if (days === 0) return `${t.today}, ${formatTime(at)}`;
    if (days === 1) return t.yesterday;
    return formatDate(at, { weekday: "long" });
  }, [t]);
}

/** Each kind's colours: a soft ground, dark ink for text on it, a strong accent for buttons, and an icon */
export const KIND_THEME = {
  FRESH_TODAY: { ground: "#dcfce7", ink: "#14532d", accent: "#15803d", icon: "leaf" },
  NEW_IN_STORE: { ground: "#dbeafe", ink: "#1e3a8a", accent: "#1d4ed8", icon: "sparkles" },
  BACK_IN_STOCK: { ground: "#fef3c7", ink: "#78350f", accent: "#b45309", icon: "refresh" },
} as const;

export function KindTag({ kind }: { kind: StorePost["kind"] }) {
  const t = useStrings("storeVoice");
  return (
    <View style={[styles.tag, { backgroundColor: KIND_THEME[kind].ground }]}>
      <Text style={[styles.tagText, { color: KIND_THEME[kind].ink }]}>{t.kind[kind]}</Text>
    </View>
  );
}

// Logos are often wide wordmarks: the plate starts wide, then takes the logo's own shape once it loads
const LOGO_ASPECT = 1.8;
const MAX_ASPECT = 2.6;

/** The store's logo on a plate shaped like it, else the owner's initial on teal */
export function OwnerAvatar({ name, logoUrl, size = 40, style }: { name: string; logoUrl?: string | null; size?: number; style?: ViewStyle }) {
  const [aspect, setAspect] = useState(LOGO_ASPECT);
  if (logoUrl) {
    const width = size * Math.min(Math.max(aspect, 1), MAX_ASPECT);
    return (
      <View style={[styles.logo, { width, height: size, borderRadius: size * 0.28, padding: size * 0.08 }, style]}>
        <Image
          source={{ uri: logoUrl }} style={styles.logoImg} resizeMode="contain"
          onLoad={(e) => { const { width: w, height: h } = e.nativeEvent.source; if (w && h) setAspect(w / h); }}
        />
      </View>
    );
  }
  return (
    <View style={[styles.initial, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={[styles.initialText, { fontSize: size * 0.42 }]}>{name.slice(0, 1).toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tag: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  tagText: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.3 },
  logo: { backgroundColor: "#ffffff", borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImg: { width: "100%", height: "100%" },
  initial: { backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  initialText: { fontFamily: fonts.extrabold, color: "#ffffff" },
});
