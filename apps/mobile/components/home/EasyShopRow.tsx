import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useShoppingList } from "../../lib/use-shopping-list";
import { useReorder } from "../orders/use-reorder";
import { useLastOrderId } from "../orders/use-last-order-id";
import { BuyAgainSheet } from "../order/BuyAgainSheet";
import { ConfirmSheet } from "../ConfirmSheet";

interface PillProps {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  onTint: boolean;
  count?: number;
  busy?: boolean;
}

function Pill({ icon, label, onPress, onTint, count, busy }: PillProps) {
  return (
    <TouchableOpacity
      style={[styles.pill, onTint && styles.pillOnTint]} onPress={onPress} disabled={busy} activeOpacity={0.8}
      accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label}
    >
      <View style={[styles.icon, onTint && styles.iconOnTint]}>
        {busy ? <ActivityIndicator size="small" color="#ffffff" /> : <Ionicons name={icon} size={15} color="#ffffff" />}
        {/* On the icon's corner, so a long (Tamil) label keeps the pill's width */}
        {count ? <View style={styles.count}><Text style={styles.countText}>{count}</Text></View> : null}
      </View>
      {/* Tamil labels run long: wrap to two lines before shrinking much */}
      <Text style={styles.label} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.85}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Ways to shop without searching, right under the search bar: speak a list, the running list, last order again */
export function EasyShopRow({ onTint = false }: { onTint?: boolean }) {
  const t = useStrings("shoppingList");
  const r = useStrings("orders").reorder;
  const { getLocalizedName } = useLanguage();
  const list = useShoppingList();
  const lastOrderId = useLastOrderId();
  const reorder = useReorder();
  return (
    <>
      <View style={styles.row}>
        <Pill icon="mic" label={t.homeSpeak} onPress={() => router.push("/speak-list")} onTint={onTint} />
        <Pill icon="list" label={t.homeMyList} count={list.items.length} onPress={() => router.push("/my-list")} onTint={onTint} />
        {lastOrderId && (
          <Pill icon="refresh" label={t.homeSameAsLast} busy={reorder.reorderingId === lastOrderId} onPress={() => reorder.reorder(lastOrderId)} onTint={onTint} />
        )}
      </View>
      <BuyAgainSheet choices={reorder.choices} onAdd={reorder.addPicked} onClose={reorder.closeChoices} />
      <ConfirmSheet
        visible={reorder.pending !== null} title={r.replaceCartTitle}
        message={r.replaceCartMessage(reorder.pending ? getLocalizedName(reorder.pending.store) : undefined)}
        icon="cart-outline" iconColor={colors.primary} confirmLabel={r.replaceCart} destructive={false}
        onConfirm={reorder.confirmReplace} onCancel={reorder.dismissReplace}
      />
    </>
  );
}

const styles = StyleSheet.create({
  // Spans the search bar's width: equal pills, each shrinking a long (Tamil) label rather than cutting it
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  pill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, paddingLeft: 6, paddingRight: 10, borderRadius: 22,
    backgroundColor: "#f0fdfa", borderWidth: 1, borderColor: "#99f6e4",
  },
  pillOnTint: { backgroundColor: "rgba(255,255,255,0.92)", borderColor: "rgba(255,255,255,0.6)" },
  icon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" },
  iconOnTint: { backgroundColor: colors.primaryDark },
  label: { flexShrink: 1, fontSize: 14, lineHeight: 17, fontFamily: fonts.bold, color: colors.primaryDark },
  count: {
    position: "absolute", top: -6, left: -6, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#ffffff",
  },
  countText: { fontSize: 10.5, fontFamily: fonts.extrabold, color: colors.accentText },
});
