import { memo } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import type { LooseStapleAisle, LooseStapleItem } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { draftChange, type Drafts } from "./use-loose-staples";

interface AisleCardProps {
  aisle: LooseStapleAisle;
  /** Every size in the aisle, for the "listed" tally whatever the tab shows */
  total: { listed: number; sizes: number };
  drafts: Drafts;
  onPrice: (variantId: string, text: string) => void;
  onFill: (items: LooseStapleItem[]) => void;
}

// What the store does with this size now, or what a fair starting price would be
function noteOf(item: LooseStapleItem) {
  if (item.listed?.isActive) return { text: `Selling at ₹${item.listed.price} · ${item.listed.stock} in stock`, tone: styles.live };
  if (item.listed) return { text: `Turned off · was ₹${item.listed.price}`, tone: styles.note };
  if (item.suggested !== null) return { text: `Suggested ₹${item.suggested}`, tone: styles.note };
  return { text: "Set your price", tone: styles.note };
}

function StapleRow({ item, draft, changed, onPrice }: { item: LooseStapleItem; draft: string | undefined; changed: boolean; onPrice: AisleCardProps["onPrice"] }) {
  const note = noteOf(item);
  return (
    <View style={styles.row}>
      <View style={styles.photo}>{item.imageUrl ? <Image source={{ uri: item.imageUrl }} style={styles.photoImg} resizeMode="contain" /> : null}</View>
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.size}>{item.size}</Text>
        <Text style={[styles.noteBase, note.tone]} numberOfLines={1}>{note.text}</Text>
      </View>
      <View style={[styles.priceBox, changed && styles.priceChanged]}>
        <Text style={styles.rupee}>{"₹"}</Text>
        <TextInput
          style={[styles.price, tabular]} value={draft ?? ""} onChangeText={(t) => onPrice(item.variantId, t)}
          placeholder={String(item.listed?.price ?? item.suggested ?? "")} placeholderTextColor={manage.muted}
          keyboardType="decimal-pad" returnKeyType="done" maxLength={7} accessibilityLabel={`Price for ${item.name} ${item.size}`}
        />
      </View>
    </View>
  );
}

/** One staple aisle: its sizes with a price box each, and a tap to start from the suggested prices */
export const AisleCard = memo(function AisleCard({ aisle, total, drafts, onPrice, onFill }: AisleCardProps) {
  const fillable = aisle.items.some((i) => !i.listed && i.suggested !== null && drafts[i.variantId] === undefined);
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.category}>{aisle.category.toUpperCase()}</Text>
          <Text style={styles.aisle}>{aisle.name}</Text>
          <Text style={[styles.tally, tabular]}>{`${total.listed} of ${total.sizes} sizes on sale`}</Text>
        </View>
        {fillable && (
          <TouchableOpacity style={styles.fill} onPress={() => onFill(aisle.items)} accessibilityRole="button">
            <Text style={styles.fillText}>Use suggested</Text>
          </TouchableOpacity>
        )}
      </View>
      {aisle.items.map((item) => (
        <StapleRow key={item.variantId} item={item} draft={drafts[item.variantId]} changed={draftChange(item, drafts) !== null} onPrice={onPrice} />
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { marginHorizontal: 12, marginTop: 12, backgroundColor: manage.card, borderRadius: radius.xl, borderWidth: 1, borderColor: manage.line, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 4 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 6 },
  headText: { flex: 1 },
  category: { fontFamily: fonts.bold, fontSize: 10.5, letterSpacing: 1.1, color: colors.primary },
  aisle: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.text, marginTop: 2 },
  tally: { fontFamily: fonts.semibold, fontSize: 12.5, color: manage.muted, marginTop: 2 },
  fill: { minHeight: 44, justifyContent: "center", paddingHorizontal: 12, borderRadius: 999, backgroundColor: manage.tint },
  fillText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderTopWidth: 1, borderTopColor: manage.hairline },
  photo: { width: 44, height: 44, borderRadius: radius.md, backgroundColor: manage.hairline, overflow: "hidden" },
  photoImg: { width: "100%", height: "100%" },
  body: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 14.5, color: colors.text },
  size: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.textSecondary, marginTop: 1 },
  noteBase: { fontFamily: fonts.semibold, fontSize: 12, marginTop: 2 },
  note: { color: manage.muted },
  live: { color: "#15803d" },
  priceBox: { flexDirection: "row", alignItems: "center", width: 96, height: 44, borderRadius: radius.lg, borderWidth: 1.5, borderColor: manage.line, paddingHorizontal: 10, backgroundColor: "#fff" },
  priceChanged: { borderColor: colors.primary, backgroundColor: manage.tint },
  rupee: { fontFamily: fonts.bold, fontSize: 15, color: colors.textSecondary, marginRight: 4 },
  price: { flex: 1, fontFamily: fonts.extrabold, fontSize: 16, color: colors.text, paddingVertical: 0 },
});
