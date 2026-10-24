import { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, Pressable, Animated, StyleSheet } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { DEFAULT_SEARCH_HINTS, DEFAULT_SEARCH_HINT_TRANSLATIONS } from "@martly/shared/constants";
import { colors, fonts } from "../constants/theme";
import { useStrings } from "../lib/i18n/use-strings";
import { useLanguage } from "../lib/language-context";

const ROTATE_MS = 2600;

interface Props {
  /** onTint: the bar sits on a coloured festive header, so it turns white to stay distinct */
  onTint?: boolean;
  /** What the placeholder cycles through; the everyday defaults when the server sends none */
  hints?: string[];
  /** The rotation in other languages, by language */
  hintTranslations?: Record<string, string[]>;
}

export function SearchBarButton({ onTint = false, hints, hintTranslations }: Props) {
  const t = useStrings("search");
  const { language } = useLanguage();
  // In another language the bar cycles that language's words; English ones would sit oddly in its sentence
  const suggestions = useMemo(() => {
    if (!language || !DEFAULT_SEARCH_HINT_TRANSLATIONS[language]) return hints?.length ? hints : DEFAULT_SEARCH_HINTS;
    const own = hintTranslations?.[language];
    return own?.length ? own : Object.values(DEFAULT_SEARCH_HINT_TRANSLATIONS[language]);
  }, [language, hints, hintTranslations]);
  const [index, setIndex] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  // A new list can be shorter than where the rotation had got to
  useEffect(() => setIndex(0), [suggestions]);

  useEffect(() => {
    const timer = setInterval(() => {
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setIndex((i) => (i + 1) % suggestions.length);
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [fade, suggestions]);

  return (
    <View style={[styles.bar, onTint && styles.barOnTint]}>
      <Pressable
        style={styles.searchArea}
        onPress={() => router.push("/search")}
        accessibilityRole="search"
        accessibilityLabel={t.searchGroceries}
      >
        <Ionicons name="search-outline" size={18} color={colors.textSecondary} />
        <Text style={styles.placeholder} numberOfLines={1}>
          {t.searchForBefore}
          <Animated.Text style={[styles.suggestion, { opacity: fade }]}>{`"${suggestions[index] ?? suggestions[0]}"`}</Animated.Text>
          {t.searchForAfter}
        </Text>
      </Pressable>
      <View style={styles.divider} />
      <Pressable
        style={({ pressed }) => [styles.mic, pressed && { opacity: 0.6 }]}
        onPress={() => router.push({ pathname: "/search", params: { voice: "1" } })}
        accessibilityRole="button"
        accessibilityLabel={t.searchByVoice}
        hitSlop={6}
      >
        <Ionicons name="mic-outline" size={20} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row", alignItems: "center", height: 46,
    backgroundColor: "#f1f5f9", borderRadius: 12, paddingLeft: 14,
  },
  barOnTint: { backgroundColor: "#fff", shadowColor: "#78350f", shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  searchArea: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, height: "100%" },
  placeholder: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: "#94a3b8" },
  suggestion: { fontFamily: fonts.semibold, color: colors.textSecondary },
  divider: { width: 1, height: 22, backgroundColor: colors.border },
  mic: { width: 48, height: "100%", alignItems: "center", justifyContent: "center" },
});
