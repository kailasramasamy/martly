import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { aiImageLevel, type AiImageLevel } from "./ai-images";
import type { AiImages } from "./plan-types";

interface Props {
  aiImages: AiImages | undefined;
  /** AI images the action takes */
  cost: number;
  onBuy: () => void;
}

const LOOKS: Record<AiImageLevel, { bg: string; ink: string; bar: string; icon: keyof typeof Ionicons.glyphMap }> = {
  ok: { bg: manage.tint, ink: colors.primaryDark, bar: colors.primary, icon: "sparkles" },
  low: { bg: manage.attentionBg, ink: manage.attentionText, bar: manage.attention, icon: "sparkles" },
  out: { bg: "#fee2e2", ink: colors.error, bar: colors.error, icon: "alert-circle" },
};

const plural = (n: number) => `${n} AI image${n === 1 ? "" : "s"}`;

function detail(ai: AiImages) {
  const month = `${ai.planLeft} of ${ai.total} left this month`;
  return ai.packBalance > 0 ? `${month} · ${ai.packBalance} from packs` : month;
}

/**
 * The AI-image meter above a generate button: what's left in bold with what the action uses, and a bar of the month's
 * plan images. Teal when fine, amber with "Buy more" when low, red when there isn't enough for the action.
 */
export function AiImageUsage({ aiImages, cost, onBuy }: Props) {
  if (!aiImages) return null;
  const level = aiImageLevel(aiImages, cost);
  const look = LOOKS[level];
  const share = aiImages.total > 0 ? aiImages.planLeft / aiImages.total : 0;
  return (
    <View style={[styles.card, { backgroundColor: look.bg }]} accessibilityRole="summary">
      <View style={styles.head}>
        <Ionicons name={look.icon} size={16} color={look.ink} />
        <Text style={[styles.left, { color: look.ink }, tabular]}>
          {level === "out" ? `Not enough AI images` : `${plural(aiImages.left)} left`}
        </Text>
        <Text style={[styles.cost, { color: look.ink, borderColor: look.ink }]}>{`Uses ${cost}`}</Text>
      </View>
      <View style={styles.track}><View style={[styles.fill, { width: `${Math.round(share * 100)}%`, backgroundColor: look.bar }]} /></View>
      <View style={styles.foot}>
        <Text style={[styles.detail, tabular]}>{detail(aiImages)}</Text>
        {level !== "ok" ? (
          <TouchableOpacity onPress={onBuy} style={styles.buy} accessibilityRole="button" accessibilityLabel="Buy more AI images">
            <Text style={[styles.buyText, { color: look.ink }]}>Buy more</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  left: { flex: 1, fontFamily: fonts.extrabold, fontSize: 15 },
  cost: { fontFamily: fonts.bold, fontSize: 11, borderWidth: 1, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, overflow: "hidden" },
  track: { height: 4, borderRadius: 2, backgroundColor: "rgba(15, 23, 42, 0.08)", overflow: "hidden" },
  fill: { height: 4, borderRadius: 2 },
  foot: { flexDirection: "row", alignItems: "center", minHeight: 32 },
  detail: { flex: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  buy: { minHeight: 44, minWidth: 44, paddingHorizontal: 8, alignItems: "flex-end", justifyContent: "center", marginVertical: -6 },
  buyText: { fontFamily: fonts.extrabold, fontSize: 13, textDecorationLine: "underline" },
});
