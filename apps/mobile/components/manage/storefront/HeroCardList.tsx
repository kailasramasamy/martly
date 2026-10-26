import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { HERO_CARD_GUIDE, type HeroCardKind } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { useBilingual } from "./storefront";
import { heroFixHref } from "./use-hero-cards";

export type HeroCardRow = NonNullable<StorefrontCheckResult["cards"]>[number];

interface HeroCardListProps {
  rows: HeroCardRow[];
  storeId: string;
  /** Shown as a remove button on each row, on the hero cards screen */
  onRemove?: (index: number) => void;
}

function Row({ row, storeId, onRemove }: { row: HeroCardRow; storeId: string; onRemove?: () => void }) {
  const router = useRouter();
  const text = useBilingual();
  const guide = HERO_CARD_GUIDE[row.kind as HeroCardKind];
  // On the hero cards screen the "Right now" collections are set right below the list
  const inline = onRemove && guide.fix === "RIGHT_NOW";
  const fix = !row.ready && guide.fix && !inline ? heroFixHref(guide.fix, storeId, row.collectionId) : null;
  // A card with nothing to set up (festival, most bought) waits on its own rather than asking the owner for anything
  const waiting = !row.ready && !guide.fix;
  const icon = row.ready ? "checkmark-circle" : waiting ? "time-outline" : "ellipse-outline";
  return (
    <View style={styles.row}>
      <Ionicons name={icon} size={22} color={row.ready ? "#16a34a" : waiting ? manage.muted : "#d97706"} />
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{row.title ? `${text(guide.name)} · ${row.title}` : text(guide.name)}</Text>
        <Text style={[styles.note, !row.ready && !waiting && styles.needs]}>{row.ready ? "Showing on Home" : text(guide.needs)}</Text>
        {waiting && row.need !== undefined && <Text style={styles.progress}>{`Automatic · ${row.have ?? 0} of ${row.need} bought so far`}</Text>}
        {waiting && row.need === undefined && <Text style={styles.progress}>Automatic</Text>}
      </View>
      {fix && (
        <TouchableOpacity onPress={() => router.push(fix)} hitSlop={8} accessibilityRole="button" style={styles.link}>
          <Text style={styles.linkText}>Set up</Text>
        </TouchableOpacity>
      )}
      {onRemove && (
        <TouchableOpacity onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${text(guide.name)} card`} style={styles.remove}>
          <Ionicons name="close" size={20} color={manage.muted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

/** The carousel's cards in order: ready ones tick, the rest say what they need and link to where it's set up */
export function HeroCardList({ rows, storeId, onRemove }: HeroCardListProps) {
  return (
    <View style={styles.list}>
      {rows.map((row, i) => (
        <Row key={`${row.kind}-${row.collectionId ?? i}`} row={row} storeId={storeId} onRemove={onRemove && (() => onRemove(i))} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderTopWidth: 1, borderTopColor: manage.hairline, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  body: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  note: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: manage.muted, marginTop: 2 },
  needs: { color: "#b45309" },
  progress: { fontFamily: fonts.bold, fontSize: 12, color: colors.primary, marginTop: 3 },
  link: { minHeight: 44, justifyContent: "center", paddingHorizontal: 6 },
  linkText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  remove: { minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" },
});
