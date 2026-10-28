import { memo, useEffect, useRef } from "react";
import { View, Text, Image, TextInput, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PriceReviewItem } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { formatINR, manage, tabular } from "../ui/tokens";
import { OUTCOME_TONES, type Settled as SettledAs } from "./ProgressHero";
import type { Draft } from "./use-review-queue";

interface Props {
  item: PriceReviewItem;
  active: boolean;
  draft: Draft;
  /** Settled on this screen; shown compact with its outcome */
  settledAs?: SettledAs;
  onOpen: () => void;
  onKeep: () => void;
  onDraft: (draft: Draft) => void;
  onSubmit: () => void;
  onUndo: () => void;
}

const OUTCOME_LABEL: Record<SettledAs, string> = { KEPT: "Price kept", CHANGED: "Price changed", notCarried: "Not sold here" };
const UNDO_LABEL: Record<SettledAs, string> = { KEPT: "Undo", CHANGED: "Reopen", notCarried: "Sell it" };

function offText(price: number, mrp: number | null) {
  if (!mrp || !price) return null;
  const off = Math.round((1 - price / mrp) * 100);
  return off > 0 ? `${off}% below MRP` : off === 0 ? "At MRP" : "Above MRP";
}

function Thumb({ uri, small }: { uri: string | null; small?: boolean }) {
  const style = [styles.thumb, small && styles.thumbSmall];
  return uri ? <Image source={{ uri }} style={style} /> : <View style={[style, styles.thumbEmpty]}><Ionicons name="image-outline" size={18} color={manage.muted} /></View>;
}

function Settled({ item, outcome, onUndo }: { item: PriceReviewItem; outcome: SettledAs; onUndo: () => void }) {
  return (
    <View style={[styles.row, styles.settled]}>
      <View>
        <Thumb uri={item.imageUrl} small />
        <View style={[styles.tick, { backgroundColor: OUTCOME_TONES[outcome].color }]}><Ionicons name={outcome === "notCarried" ? "eye-off" : "checkmark"} size={11} color="#fff" /></View>
      </View>
      <View style={styles.body}>
        <Text style={styles.settledName} numberOfLines={1}>{item.productName}</Text>
        <Text style={styles.sub} numberOfLines={1}>{item.variantName} · {OUTCOME_LABEL[outcome]}</Text>
      </View>
      <Text style={[styles.settledMeta, tabular]}>{outcome === "notCarried" ? "" : formatINR(item.price)}</Text>
      <TouchableOpacity onPress={onUndo} hitSlop={12} accessibilityRole="button"><Text style={styles.undo}>{UNDO_LABEL[outcome]}</Text></TouchableOpacity>
    </View>
  );
}

// autoFocus on a row that mounts inside a FlatList is unreliable on iOS; focusing after layout keeps the keypad up
const FOCUS_DELAY_MS = 80;

function Editor({ item, draft, onDraft, onSubmit }: Pick<Props, "item" | "draft" | "onDraft" | "onSubmit">) {
  const priceRef = useRef<TextInput>(null);
  useEffect(() => {
    const timer = setTimeout(() => priceRef.current?.focus(), FOCUS_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);
  const price = Number(draft.price) || 0;
  const mrp = draft.mrp === "" ? item.masterMrp : Number(draft.mrp);
  const over = mrp !== null && price > mrp;
  const hint = over ? "Price is above the MRP" : mrp && price < mrp * 0.5 ? "Less than half the MRP: typo?" : offText(price, mrp);
  return (
    <View style={styles.editor}>
      <View style={styles.fields}>
        <View style={styles.mrpBox}>
          <Text style={styles.fieldLabel}>MRP on pack</Text>
          <TextInput style={[styles.mrpInput, tabular]} value={draft.mrp} onChangeText={(mrpText) => onDraft({ ...draft, mrp: mrpText })}
            keyboardType="decimal-pad" selectTextOnFocus placeholder="—" placeholderTextColor={manage.muted} accessibilityLabel="MRP" />
        </View>
        <View style={[styles.priceBox, over && styles.priceBoxBad]}>
          <Text style={styles.fieldLabel}>Your price</Text>
          <View style={styles.priceLine}>
            <Text style={styles.rupee}>{"₹"}</Text>
            <TextInput ref={priceRef} style={[styles.priceInput, tabular]} value={draft.price} onChangeText={(p) => onDraft({ ...draft, price: p })}
              keyboardType="decimal-pad" onSubmitEditing={onSubmit} selectTextOnFocus accessibilityLabel="Price" />
          </View>
        </View>
      </View>
      <Text style={[styles.hint, (over || hint?.includes("typo")) && styles.hintBad]}>
        {hint}{item.masterMrp !== null && mrp !== item.masterMrp ? ` · catalog MRP ${formatINR(item.masterMrp)}` : ""}
      </Text>
    </View>
  );
}

/** A listing in the queue: tap to edit, ✓ to keep its price as is */
export const ReviewRow = memo(function ReviewRow(props: Props) {
  const { item, active, settledAs } = props;
  if (settledAs && !active) return <Settled item={item} outcome={settledAs} onUndo={props.onUndo} />;
  const off = offText(item.price, item.mrp);
  return (
    <View style={[styles.card, active && styles.cardActive, item.suspicious && !active && styles.cardOdd]}>
      <TouchableOpacity style={styles.row} onPress={props.onOpen} activeOpacity={0.7} disabled={active} accessibilityRole="button" accessibilityLabel={`Edit ${item.productName} ${item.variantName}`}>
        <Thumb uri={item.imageUrl} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>{item.productName}</Text>
          <Text style={styles.sub} numberOfLines={1}>{item.variantName}{item.mrp !== null ? ` · MRP ${formatINR(item.mrp)}` : " · no MRP"}{off ? ` · ${off}` : ""}</Text>
          {(item.unitsSold30d > 0 || item.outcome) && (
            <View style={styles.tags}>
              {item.unitsSold30d > 0 && <Text style={[styles.sold, tabular]}>{item.unitsSold30d} sold this month</Text>}
              {item.outcome && <Text style={styles.outcome}>{OUTCOME_LABEL[item.outcome]}</Text>}
            </View>
          )}
        </View>
        {!active && <Text style={[styles.price, tabular]}>{formatINR(item.price, { decimals: true })}</Text>}
        {!active && !item.outcome && (
          <TouchableOpacity style={styles.keep} onPress={props.onKeep} hitSlop={6} accessibilityRole="button" accessibilityLabel={`Keep ${formatINR(item.price)}`}>
            <Ionicons name="checkmark" size={22} color={colors.primary} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
      {active && <Editor item={item} draft={props.draft} onDraft={props.onDraft} onSubmit={props.onSubmit} />}
    </View>
  );
});

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  cardActive: { backgroundColor: manage.tint, borderLeftWidth: 3, borderLeftColor: colors.primary },
  cardOdd: { backgroundColor: "#fffbeb" },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  thumb: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: manage.hairline },
  thumbSmall: { width: 40, height: 40, opacity: 0.85 },
  thumbEmpty: { alignItems: "center", justifyContent: "center" },
  body: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.semibold, fontSize: 14.5, color: colors.text, lineHeight: 19 },
  sub: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  tags: { flexDirection: "row", gap: 6, marginTop: 2 },
  sold: { fontFamily: fonts.bold, fontSize: 11, color: manage.attentionText, backgroundColor: manage.attentionBg, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" },
  outcome: { fontFamily: fonts.bold, fontSize: 11, color: colors.primaryDark, backgroundColor: manage.tint, borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 2, overflow: "hidden" },
  price: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text, letterSpacing: -0.3 },
  keep: { width: 44, height: 44, borderRadius: 22, borderWidth: 1.5, borderColor: colors.primary, alignItems: "center", justifyContent: "center" },
  editor: { paddingHorizontal: 16, paddingBottom: 14, gap: 8 },
  fields: { flexDirection: "row", gap: 10 },
  mrpBox: { width: 112, borderRadius: radius.md, borderWidth: 1, borderColor: manage.line, backgroundColor: manage.card, paddingHorizontal: 12, paddingVertical: 8 },
  priceBox: { flex: 1, borderRadius: radius.md, borderWidth: 2, borderColor: colors.primary, backgroundColor: manage.card, paddingHorizontal: 12, paddingVertical: 6 },
  priceBoxBad: { borderColor: colors.error },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.3 },
  mrpInput: { fontFamily: fonts.bold, fontSize: 18, color: colors.text, paddingVertical: 2 },
  priceLine: { flexDirection: "row", alignItems: "center", gap: 2 },
  rupee: { fontFamily: fonts.bold, fontSize: 22, color: colors.textSecondary },
  priceInput: { flex: 1, fontFamily: fonts.extrabold, fontSize: 26, color: colors.text, paddingVertical: 0, letterSpacing: -0.5 },
  hint: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  hintBad: { color: "#b45309", fontFamily: fonts.semibold },
  settled: { backgroundColor: manage.canvas, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: manage.hairline },
  tick: {
    position: "absolute", right: -5, bottom: -5, width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: manage.canvas,
    alignItems: "center", justifyContent: "center",
  },
  settledName: { fontFamily: fonts.medium, fontSize: 13.5, color: colors.text },
  settledMeta: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  undo: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
});
