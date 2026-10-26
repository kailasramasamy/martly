import { memo } from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { lineTotal } from "@martly/shared/offers";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { getBestPrice, useMembership } from "../../lib/membership-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { MonthlyListLine, StoreProduct } from "../../lib/types";

const MAX_QTY = 99;

interface Props {
  item: MonthlyListLine;
  on: boolean;
  swap: StoreProduct | undefined;
  /** The aisle card's last row: rounded at the bottom, no divider */
  last: boolean;
  onToggle: (itemId: string) => void;
  /** 0 takes the line off the list */
  onQuantity: (itemId: string, quantity: number) => void;
  /** Change the line's size or brand */
  onOpen: (itemId: string) => void;
  /** For a line that's out today: the nearest in stock (null when nothing is), undefined when the line is in stock */
  alternative?: StoreProduct | null;
  /** Take the alternative for this month only */
  onSwap: (itemId: string) => void;
}

function Stepper({ qty, onChange }: { qty: number; onChange: (n: number) => void }) {
  const t = useStrings("monthlyList");
  return (
    <View style={styles.stepper}>
      <TouchableOpacity style={styles.step} onPress={() => onChange(qty - 1)} accessibilityLabel={qty <= 1 ? t.removeFromList : t.fewer} hitSlop={{ top: 8, bottom: 8 }}>
        <Ionicons name={qty <= 1 ? "trash-outline" : "remove"} size={16} color={qty <= 1 ? "#b91c1c" : colors.primary} />
      </TouchableOpacity>
      <Text style={styles.qty}>{qty}</Text>
      <TouchableOpacity style={styles.step} onPress={() => onChange(qty + 1)} disabled={qty >= MAX_QTY} accessibilityLabel={t.more} hitSlop={{ top: 8, bottom: 8 }}>
        <Ionicons name="add" size={16} color={colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

// The price change since last month as a small chip: red when it went up, green when down
function Delta({ delta }: { delta: number }) {
  const t = useStrings("monthlyList");
  const up = delta > 0;
  return (
    <View style={[styles.delta, up ? styles.deltaUp : styles.deltaDown]}>
      <Text style={[styles.deltaText, up ? styles.upText : styles.downText]}>{up ? t.priceUp(`${delta}`) : t.priceDown(`${-delta}`)}</Text>
    </View>
  );
}

// Under a line that's out today: the nearest in stock with a swap for this month, and the full size and brand choice
function Alternative({ sp, quantity, onSwap, onMore }: { sp: StoreProduct | null; quantity: number; onSwap: () => void; onMore: () => void }) {
  const t = useStrings("monthlyList");
  const { getLocalizedName } = useLanguage();
  const { isMember } = useMembership();
  const more = (
    <TouchableOpacity style={styles.altMore} onPress={onMore} accessibilityRole="button">
      <Text style={styles.altMoreText}>{t.otherOptions}</Text>
    </TouchableOpacity>
  );
  if (!sp) {
    return <View style={styles.alt}><Text style={styles.altNone}>{t.outNoSwap}</Text>{more}</View>;
  }
  const each = Math.round(getBestPrice(sp, isMember)).toLocaleString("en-IN");
  const image = sp.product.imageUrl ?? sp.variant.imageUrl;
  return (
    <View style={styles.alt}>
      <View style={styles.altThumb}>{image && <Image source={{ uri: image }} style={styles.altImg} />}</View>
      <View style={styles.info}>
        <Text style={styles.altLabel}>{t.nearestInStock}</Text>
        <Text style={styles.altName} numberOfLines={2}>{getLocalizedName(sp.product)}</Text>
        <Text style={styles.size} numberOfLines={1}>{`${sp.variant.name} · ₹${each}${quantity > 1 ? ` × ${quantity}` : ""}`}</Text>
      </View>
      <TouchableOpacity style={styles.altSwap} onPress={onSwap} accessibilityRole="button" accessibilityLabel={t.swap}>
        <Text style={styles.altSwapText}>{t.swapShort}</Text>
      </TouchableOpacity>
      {more}
    </View>
  );
}

/** One line of the list: keep it this month, how many, today's price and how it moved since last time */
export const ListRow = memo(function ListRow({ item, on, swap, last, onToggle, onQuantity, onOpen, alternative, onSwap }: Props) {
  const t = useStrings("monthlyList");
  const { getLocalizedName } = useLanguage();
  const { isMember } = useMembership();
  const sp = swap ?? item.listing;
  const available = !!sp && sp.availableStock >= item.quantity;
  const name = swap ? getLocalizedName(swap.product) : getLocalizedName(item);
  const size = swap ? `${swap.variant.name} · ${t.swapNote}` : available ? item.variantName : `${item.variantName} · ${t.outToday}`;
  const price = sp && available ? Math.round(lineTotal(getBestPrice(sp, isMember), item.quantity, sp.pricing?.offer)) : null;
  const image = swap ? swap.product.imageUrl ?? swap.variant.imageUrl : item.imageUrl;
  const delta = !swap && item.delta ? item.delta : 0;
  const ticked = on && available;
  return (
    <View style={[styles.row, last && styles.rowLast]}>
      <View style={styles.line}>
        <TouchableOpacity
          style={styles.tick} onPress={() => onToggle(item.id)} disabled={!available} hitSlop={{ top: 12, bottom: 12, left: 12, right: 4 }}
          accessibilityRole="checkbox" accessibilityState={{ checked: ticked, disabled: !available }} accessibilityLabel={t.keep(name)}
        >
          <Ionicons name={ticked ? "checkbox" : "square-outline"} size={24} color={ticked ? colors.primary : "#94a3b8"} />
        </TouchableOpacity>
        <View style={[styles.body, !(on && available) && styles.off]}>
          <TouchableOpacity style={styles.open} onPress={() => onOpen(item.id)} accessibilityRole="button" accessibilityLabel={t.changeLine(name)}>
            <View style={styles.thumb}>{image && <Image source={{ uri: image }} style={styles.thumbImg} />}</View>
            <View style={styles.info}>
              <Text style={styles.name} numberOfLines={2}>{name}</Text>
              <View style={styles.sizeRow}>
                <Text style={[styles.size, !available && styles.outText]} numberOfLines={1}>{size}</Text>
                <Ionicons name="chevron-down" size={13} color={colors.primary} />
              </View>
              {delta !== 0 && <Delta delta={delta} />}
            </View>
          </TouchableOpacity>
          <View style={styles.right}>
            <Text style={styles.price}>{price != null ? `₹${price.toLocaleString("en-IN")}` : "–"}</Text>
            {available && <Stepper qty={item.quantity} onChange={(n) => onQuantity(item.id, n)} />}
          </View>
        </View>
      </View>
      {!available && !swap && alternative !== undefined && (
        <Alternative sp={alternative} quantity={item.quantity} onSwap={() => onSwap(item.id)} onMore={() => onOpen(item.id)} />
      )}
      {!last && <View style={styles.divider} />}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { marginHorizontal: 16, paddingVertical: 12, paddingHorizontal: 12, backgroundColor: "#ffffff", borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowLast: { borderBottomWidth: 1, borderBottomLeftRadius: 14, borderBottomRightRadius: 14 },
  divider: { position: "absolute", left: 58, right: 0, bottom: 0, height: 1, backgroundColor: "#f1f5f9" },
  tick: { width: 26, alignItems: "center" },
  body: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  off: { opacity: 0.4 },
  open: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  sizeRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  thumbImg: { width: 46, height: 46, resizeMode: "contain" },
  info: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 19, color: colors.text },
  size: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  outText: { color: "#b45309", fontFamily: fonts.semibold },
  delta: { alignSelf: "flex-start", marginTop: 2, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6 },
  deltaUp: { backgroundColor: "#fef2f2" },
  deltaDown: { backgroundColor: "#f0fdf4" },
  deltaText: { fontFamily: fonts.bold, fontSize: 11 },
  upText: { color: "#b91c1c" },
  downText: { color: "#15803d" },
  right: { alignItems: "flex-end", gap: 6 },
  price: { fontFamily: fonts.extrabold, fontSize: 15, color: colors.text, fontVariant: ["tabular-nums"] },
  stepper: { flexDirection: "row", alignItems: "center", height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: colors.primary },
  step: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  alt: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10, marginLeft: 36, padding: 10, borderRadius: 12, backgroundColor: "#fffbeb", borderWidth: 1, borderColor: "#fde68a" },
  altThumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center" },
  altImg: { width: 36, height: 36, resizeMode: "contain" },
  altLabel: { fontFamily: fonts.bold, fontSize: 11, color: "#b45309" },
  altName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text },
  altNone: { flex: 1, fontFamily: fonts.medium, fontSize: 13, color: "#92400e" },
  altSwap: { height: 44, paddingHorizontal: 16, borderRadius: 22, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  altSwapText: { fontFamily: fonts.bold, fontSize: 13, color: "#ffffff" },
  altMore: { height: 44, justifyContent: "center", paddingHorizontal: 4 },
  altMoreText: { fontFamily: fonts.bold, fontSize: 13, color: colors.primary },
  qty: { minWidth: 18, textAlign: "center", fontFamily: fonts.bold, fontSize: 14, color: colors.primary, fontVariant: ["tabular-nums"] },
});
