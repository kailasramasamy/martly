import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, TouchableOpacity, Animated, Easing, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, fonts } from "../../constants/theme";
import { useStrings } from "../../lib/i18n/use-strings";
import type { ReviewState } from "../../lib/cart-builder";
import { ChoicePicker } from "./ChoicePicker";

const BADGE = {
  FINDING: { icon: "hourglass-outline", color: colors.textSecondary, bg: "#f1f5f9" },
  ADDED: { icon: "checkmark-circle", color: colors.primary, bg: "#ccfbf1" },
  PICK: { icon: "hand-left", color: colors.accentText, bg: "#fef3c7" },
  NOT_FOUND: { icon: "alert-circle", color: colors.textSecondary, bg: "#f1f5f9" },
} as const;

const HOP_ICONS = ["leaf", "nutrition", "egg", "basket"] as const;

/** Grocery icons hopping in turn, with what's being looked for, where a line's products will appear */
function LineFinding({ item }: { item: string }) {
  const t = useStrings("shoppingList");
  const wave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(wave, { toValue: 1, duration: 1200, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [wave]);
  return (
    <View style={styles.finding}>
      <View style={styles.hops}>
        {HOP_ICONS.map((icon, i) => {
          // Each icon hops in its own quarter of the cycle
          const at = i / HOP_ICONS.length;
          const translateY = wave.interpolate({ inputRange: [0, at, at + 0.125, at + 0.25, 1], outputRange: [0, 0, -10, 0, 0], extrapolate: "clamp" });
          return (
            <Animated.View key={icon} style={[styles.hop, { transform: [{ translateY }] }]}>
              <Ionicons name={icon} size={20} color={colors.primary} />
            </Animated.View>
          );
        })}
      </View>
      <Text style={styles.findingText} numberOfLines={2}>{t.findingFor(item)}</Text>
    </View>
  );
}

/** The shopper's words for a line; ✎ turns them into a field to re-word and search again */
function Said({ text, draft, setDraft, onResearch }: {
  text: string; draft: string | null; setDraft: (draft: string | null) => void; onResearch: (text: string) => void;
}) {
  const t = useStrings("shoppingList");
  const tc = useStrings("common");
  const submit = () => {
    const next = draft?.trim();
    setDraft(null);
    if (next && next !== text) onResearch(next);
  };
  if (draft === null) {
    return (
      <TouchableOpacity style={[styles.said, styles.saidRow]} onPress={() => setDraft(text)} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={t.editWords}>
        <View style={styles.saidBody}>
          <Text style={styles.saidLabel}>{t.youSaid}</Text>
          <Text style={styles.saidText} numberOfLines={2}>“{text}”</Text>
        </View>
        <View style={styles.editBtn}>
          <Ionicons name="pencil" size={17} color="#a16207" />
        </View>
      </TouchableOpacity>
    );
  }
  // Field and buttons on one row, so scrolling the field above the keyboard brings the buttons with it
  return (
    <View style={[styles.said, styles.saidEditing]}>
      <TextInput style={styles.saidInput} value={draft} onChangeText={setDraft} autoFocus returnKeyType="search" onSubmitEditing={submit} />
      <TouchableOpacity style={styles.again} onPress={submit} accessibilityRole="button" accessibilityLabel={t.searchAgain}>
        <Ionicons name="search" size={20} color="#ffffff" />
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancel} onPress={() => setDraft(null)} accessibilityRole="button" accessibilityLabel={tc.cancel}>
        <Ionicons name="close" size={22} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

/** One line of the list: the shopper's own words on top, then the store's products for it once found */
export function ReviewLine({ entry, inCart, onResearch }: { entry: ReviewState["lines"][number]; inCart: boolean; onResearch: (text: string) => void }) {
  const t = useStrings("shoppingList");
  // Re-wording: the field takes the badge's room
  const [draft, setDraft] = useState<string | null>(null);
  const { line } = entry;
  const state = !line ? "FINDING" : inCart ? "ADDED" : line.candidates.length > 0 ? "PICK" : "NOT_FOUND";
  const badge = BADGE[state];
  const label = { FINDING: t.findingLine, ADDED: t.added, PICK: t.pickOne, NOT_FOUND: t.notFound }[state];
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Said text={entry.text} draft={draft} setDraft={setDraft} onResearch={onResearch} />
        {draft === null && (
          <View style={[styles.badge, { backgroundColor: badge.bg }]}>
            <Ionicons name={badge.icon} size={14} color={badge.color} />
            <Text style={[styles.badgeText, { color: badge.color }]}>{label}</Text>
          </View>
        )}
      </View>
      {!line ? (
        <LineFinding item={entry.item} />
      ) : line.candidates.length > 0 ? (
        <ChoicePicker line={line} />
      ) : (
        <TouchableOpacity style={styles.searchBtn} onPress={() => router.push({ pathname: "/search", params: { q: entry.item } })}>
          <Ionicons name="search" size={18} color={colors.primary} />
          <Text style={styles.searchText}>{t.searchIt} “{entry.item}”</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#ffffff", borderRadius: 14, borderWidth: 1, borderColor: colors.border, padding: 14, gap: 8 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  said: { flex: 1, backgroundColor: "#fffbeb", borderLeftWidth: 3, borderLeftColor: "#fbbf24", borderRadius: 6, paddingVertical: 6, paddingHorizontal: 10 },
  saidRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingRight: 6 },
  saidBody: { flex: 1 },
  // Looks 36 across; the whole box takes the tap, so it reaches well past 44
  editBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#fde68a", alignItems: "center", justifyContent: "center" },
  saidLabel: { fontSize: 11, fontFamily: fonts.semibold, color: "#a16207", letterSpacing: 0.3, textTransform: "uppercase" },
  saidEditing: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  saidInput: { flex: 1, minHeight: 44, fontSize: 16, fontFamily: fonts.medium, color: "#422006", backgroundColor: "#ffffff", borderRadius: 8, borderWidth: 1, borderColor: "#fbbf24", paddingHorizontal: 10 },
  again: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  cancel: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  saidText: { fontSize: 15, fontFamily: fonts.medium, color: "#422006", marginTop: 1 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontFamily: fonts.bold },
  finding: { height: 180, alignItems: "center", justifyContent: "center", gap: 14, backgroundColor: colors.surface, borderRadius: 12 },
  hops: { flexDirection: "row", gap: 12, height: 44, alignItems: "flex-end" },
  hop: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ffffff", borderWidth: 1.5, borderColor: "#99f6e4", alignItems: "center", justifyContent: "center" },
  findingText: { fontSize: 15, fontFamily: fonts.semibold, color: colors.textSecondary, textAlign: "center", paddingHorizontal: 16 },
  searchBtn: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, borderWidth: 1.5, borderColor: colors.primary, borderRadius: 22, paddingHorizontal: 16, alignSelf: "flex-start" },
  searchText: { fontSize: 14, fontFamily: fonts.semibold, color: colors.primary },
});
