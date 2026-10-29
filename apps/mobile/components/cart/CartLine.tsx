import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { amount } from "../../lib/money";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useCart, type CartItem } from "../../lib/cart-context";
import type { PackDeal } from "../../lib/types";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { colors, spacing, fontSize } from "../../constants/theme";
import type { LineStatus } from "./use-cart-review";
import { freeUnits, lineTotal, offerNudge } from "@martly/shared/offers";

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

interface CartLineProps {
  item: CartItem;
  status: LineStatus;
  /** A bigger pack of the same product that saves; tapping Switch swaps the line for it */
  deal: PackDeal | null;
  onSwitch: (deal: PackDeal) => void;
  onDecrement: () => void;
  onIncrement: () => void;
  onRemove: () => void;
}

/**
 * One cart line; notes a price the store changed, low stock, or that it can't be bought any more. The picture and
 * name open the product page.
 */
export function CartLine({ item, status, deal, onSwitch, onDecrement, onIncrement, onRemove }: CartLineProps) {
  const t = useStrings("cart");
  const { getLocalizedName } = useLanguage();
  const { storeId } = useCart();
  const atStockLimit = status.stockLeft != null && item.quantity >= status.stockLeft;
  const openProduct = () =>
    router.push({ pathname: "/product/[id]", params: storeId ? { id: item.productId, storeId } : { id: item.productId } });

  return (
    <View style={styles.card}>
      <View style={styles.cardBody}>
        <TouchableOpacity style={styles.opener} onPress={openProduct} activeOpacity={0.7} accessibilityRole="link">
          <View style={status.unavailable && styles.faded}>
            {item.imageUrl ? (
              <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
            ) : (
              <View style={styles.itemImagePlaceholder}>
                <Ionicons name="cube-outline" size={20} color={colors.border} />
              </View>
            )}
          </View>
          <View style={styles.cardMiddle}>
            <Text style={[styles.itemName, status.unavailable && styles.fadedText]} numberOfLines={2}>
              {getLocalizedName({ name: item.productName, translations: item.translations })}
            </Text>
            <Text style={styles.itemVariant}>{item.variantName}</Text>
            <Text style={styles.itemPrice}>{"\u20B9"}{amount(item.price)}</Text>
            {item.offer && <OfferNote item={item} />}
            {status.unavailable ? (
              <Text style={[styles.note, styles.noteError]}>{t.outOfStock}</Text>
            ) : status.stockLeft != null ? (
              <Text style={[styles.note, styles.noteWarn]}>{t.onlyLeft(status.stockLeft)}</Text>
            ) : status.previousPrice != null ? (
              <Text style={[styles.note, styles.noteWarn]}>{t.priceChanged(amount(status.previousPrice))}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
        {status.unavailable ? (
          <TouchableOpacity style={styles.removeBtn} onPress={onRemove} accessibilityRole="button">
            <Text style={styles.removeText}>{t.remove}</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.cardRight}>
            <View style={styles.qtyStepper}>
              <TouchableOpacity style={styles.qtyBtn} onPress={onDecrement} hitSlop={HIT_SLOP}>
                <Ionicons name={item.quantity === 1 ? "trash-outline" : "remove"} size={16} color={colors.primary} />
              </TouchableOpacity>
              <Text style={styles.qtyText}>{item.quantity}</Text>
              <TouchableOpacity style={styles.qtyBtn} onPress={onIncrement} hitSlop={HIT_SLOP} disabled={atStockLimit}>
                <Ionicons name="add" size={16} color={atStockLimit ? colors.border : colors.primary} />
              </TouchableOpacity>
            </View>
            <LineTotal item={item} />
          </View>
        )}
      </View>
      {!status.unavailable && !atStockLimit && <OfferNudge item={item} onAdd={onIncrement} />}
      {deal && !status.unavailable && (
        <TouchableOpacity style={styles.deal} onPress={() => onSwitch(deal)} activeOpacity={0.8} accessibilityRole="button">
          <Ionicons name="trending-down" size={15} color={colors.primary} />
          <Text style={styles.dealText} numberOfLines={2}>
            {deal.extra > 0
              ? t.packUpsize(deal.to.variant.name, String(deal.extra), String(deal.saves))
              : t.packSwitch(deal.quantity, deal.to.variant.name, String(deal.saves))}
          </Text>
          <Text style={styles.dealAction}>{t.switchPack}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// The offer on the line, and how many units of it come free
function OfferNote({ item }: { item: CartItem }) {
  const t = useStrings("cart");
  const tc = useStrings("common");
  const free = freeUnits(item.quantity, item.offer);
  return (
    <View style={styles.offerRow}>
      <Ionicons name="gift" size={11} color={colors.primary} />
      <Text style={styles.offerText}>{tc.buyGet(item.offer!.buy, item.offer!.get)}</Text>
      {free > 0 && <Text style={styles.freeTag}>{t.freeUnits(free)}</Text>}
    </View>
  );
}

// What the line costs, with the full price struck above it when units come free
function LineTotal({ item }: { item: CartItem }) {
  const total = lineTotal(item.price, item.quantity, item.offer);
  const full = item.price * item.quantity;
  return (
    <View style={styles.totals}>
      {full > total && <Text style={styles.fullTotal}>{"\u20B9"}{amount(full)}</Text>}
      <Text style={styles.lineTotal}>{"\u20B9"}{amount(total)}</Text>
    </View>
  );
}

// Part-way through an offer: one tap adds the units that are free (or that unlock the free ones)
function OfferNudge({ item, onAdd }: { item: CartItem; onAdd: () => void }) {
  const t = useStrings("cart");
  const nudge = offerNudge(item.quantity, item.offer);
  if (!nudge) return null;
  return (
    <TouchableOpacity style={styles.deal} onPress={onAdd} activeOpacity={0.8} accessibilityRole="button">
      <Ionicons name="gift-outline" size={15} color={colors.primary} />
      <Text style={styles.dealText} numberOfLines={2}>
        {nudge.kind === "free" ? t.nudgeFree(nudge.count) : t.nudgeBuy(nudge.count, item.offer!.get)}
      </Text>
      <Text style={styles.dealAction}>{t.addMore}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardBody: { flexDirection: "row", alignItems: "center" },
  opener: { flex: 1, flexDirection: "row", alignItems: "center" },
  faded: { opacity: 0.4 },
  fadedText: { color: colors.textSecondary },
  itemImage: { width: 56, height: 56, borderRadius: 8, backgroundColor: colors.surface },
  itemImagePlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  cardMiddle: { flex: 1, marginHorizontal: 12 },
  cardRight: { alignItems: "flex-end", justifyContent: "space-between" },
  itemName: { fontSize: 15, fontWeight: "600", color: colors.text, lineHeight: 20 },
  itemVariant: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  itemPrice: { fontSize: 13, color: colors.textSecondary, marginTop: 4 },
  note: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  noteWarn: { color: "#c2410c" },
  noteError: { color: colors.error },
  qtyStepper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 999,
    backgroundColor: colors.primary + "08",
    overflow: "hidden",
  },
  qtyBtn: { paddingHorizontal: 10, paddingVertical: 8, justifyContent: "center", alignItems: "center" },
  qtyText: { fontSize: fontSize.md, fontWeight: "700", color: colors.primary, minWidth: 24, textAlign: "center" },
  totals: { alignItems: "flex-end", marginTop: 6 },
  fullTotal: { fontSize: 12, color: colors.textSecondary, textDecorationLine: "line-through" },
  lineTotal: { fontSize: 15, fontWeight: "700", color: colors.text },
  offerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  offerText: { fontSize: 12, fontWeight: "700", color: colors.primary },
  freeTag: {
    fontSize: 11, fontWeight: "800", color: "#fff", backgroundColor: colors.success,
    paddingHorizontal: 5, borderRadius: 4, overflow: "hidden",
  },
  removeBtn: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.error,
  },
  removeText: { fontSize: fontSize.md, fontWeight: "700", color: colors.error },
  deal: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: colors.primary + "0D",
  },
  dealText: { flex: 1, fontSize: 13, fontWeight: "600", color: colors.primary, lineHeight: 18 },
  dealAction: { fontSize: 13, fontWeight: "800", color: colors.primary },
});
