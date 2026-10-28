import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CarryState } from "@martly/shared/schemas";
import type { StockCheckBrand } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { Button } from "../ui/Button";
import { manage, tabular } from "../ui/tokens";
import { PhotoStack } from "./PhotoStack";

/** The brand tab a card sits in: "all" asks only about what's still to confirm */
export type BrandTab = CarryState | "all";

interface Props {
  brand: StockCheckBrand;
  tab: BrandTab;
  /** Decided on this screen (carried or not): the card collapses to its answer with an Undo */
  decided?: boolean;
  onYes: () => void;
  onNo: () => void;
  onSizes: () => void;
  onUndo: () => void;
}

function Logo({ brand, small }: { brand: StockCheckBrand; small?: boolean }) {
  const style = [styles.logo, small && styles.logoSmall];
  return brand.imageUrl
    ? <Image source={{ uri: brand.imageUrl }} style={style} resizeMode="contain" />
    : <View style={[style, styles.initial]}><Text style={styles.initialText}>{brand.name.slice(0, 1)}</Text></View>;
}

function meta(b: StockCheckBrand, tab: BrandTab) {
  if (tab === "carried") return `${b.carried} carried${b.notCarried > 0 ? ` · ${b.notCarried} not sold` : ""}`;
  if (tab === "notCarried") return `${b.notCarried} not sold${b.carried > 0 ? ` · ${b.carried} carried` : ""}`;
  const parts = [`${b.unchecked} ${b.unchecked === 1 ? "product" : "products"}`];
  if (b.suggested > 0) parts.push(`${b.suggested} hidden ${b.suggested === 1 ? "suggestion" : "suggestions"}`);
  if (b.carried > 0) parts.push(`${b.carried} carried`);
  return parts.join(" · ");
}

function Decided({ brand, carried, onUndo }: { brand: StockCheckBrand; carried: boolean; onUndo: () => void }) {
  return (
    <View style={[styles.card, styles.decided]}>
      <View>
        <Logo brand={brand} small />
        <View style={[styles.tick, { backgroundColor: carried ? manage.live : manage.muted }]}>
          <Ionicons name={carried ? "checkmark" : "close"} size={11} color="#fff" />
        </View>
      </View>
      <Text style={styles.decidedName} numberOfLines={1}>{brand.name} · {carried ? "Carried" : "Not sold here"}</Text>
      <TouchableOpacity onPress={onUndo} hitSlop={12} accessibilityRole="button"><Text style={styles.undo}>Undo</Text></TouchableOpacity>
    </View>
  );
}

/** What the card asks: confirm the rest, bring back what's not sold, or stop selling what's carried */
function Actions({ b, tab, onYes, onNo, onSizes }: Pick<Props, "tab" | "onYes" | "onNo" | "onSizes"> & { b: StockCheckBrand }) {
  const sizes = <Button label="Sizes" variant="secondary" icon="options-outline" compact onPress={onSizes} style={styles.grow} />;
  if (tab === "notCarried") return <View style={styles.actions}><Button label="Sell again" icon="refresh" compact onPress={onYes} style={styles.grow} />{sizes}</View>;
  if (tab === "carried") return <View style={styles.actions}><Button label="Stop selling" variant="danger" compact onPress={onNo} style={styles.grow} />{sizes}</View>;
  if (b.unchecked === 0) return null;
  return (
    <View style={styles.actions}>
      <Button label="Yes, all" icon="checkmark" compact onPress={onYes} style={styles.grow} />
      <Button label="No" variant="danger" compact onPress={onNo} style={styles.grow} />
      {sizes}
    </View>
  );
}

/** A brand in one department: yes for all its products, no for none, or pick sizes; or undo an earlier answer */
export function BrandCard({ brand: b, tab, decided, onYes, onNo, onSizes, onUndo }: Props) {
  if (decided !== undefined) return <Decided brand={b} carried={decided} onUndo={onUndo} />;
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.head} onPress={onSizes} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${b.name} sizes`}>
        <Logo brand={b} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{b.name}</Text>
          <Text style={[styles.meta, tabular]} numberOfLines={1}>{meta(b, tab)}</Text>
        </View>
        <PhotoStack urls={b.sampleImages} size={40} />
      </TouchableOpacity>
      <Actions b={b} tab={tab} onYes={onYes} onNo={onNo} onSizes={onSizes} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, marginHorizontal: 16, padding: 12, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  logo: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: manage.card, borderWidth: 1, borderColor: manage.hairline },
  logoSmall: { width: 36, height: 36 },
  initial: { alignItems: "center", justifyContent: "center", backgroundColor: manage.tint, borderColor: manage.tint },
  initialText: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.primary },
  body: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  decided: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, backgroundColor: manage.hairline, borderColor: manage.hairline },
  decidedName: { flex: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.textSecondary },
  tick: { position: "absolute", right: -4, bottom: -4, width: 18, height: 18, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: manage.hairline },
  undo: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
