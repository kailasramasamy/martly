import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Loader } from "../Loader";
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
  ink: string;
  onPress: () => void;
  count?: number;
  busy?: boolean;
}

// A white pill ringed and glowing in the ink, so it takes on the colour of the hero card in view
function Pill({ icon, label, ink, onPress, count, busy }: PillProps) {
  return (
    <TouchableOpacity
      style={[styles.pill, { borderColor: `${ink}40`, shadowColor: ink }]} onPress={onPress} disabled={busy} activeOpacity={0.8}
      accessibilityRole="button" accessibilityLabel={count ? `${label}, ${count}` : label}
    >
      <View>
        {busy ? <Loader size="small" color={ink} /> : <Ionicons name={icon} size={16} color={ink} />}
        {count ? <View style={styles.count}><Text style={styles.countText}>{count}</Text></View> : null}
      </View>
      <Text style={[styles.label, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Ways to shop without searching, right under the search bar: speak a list, the running list, last order again */
export function EasyShopRow({ ink }: { ink: string }) {
  const t = useStrings("shoppingList");
  const r = useStrings("orders").reorder;
  const { getLocalizedName } = useLanguage();
  const list = useShoppingList();
  const lastOrderId = useLastOrderId();
  const reorder = useReorder();
  return (
    <>
      <View style={styles.row}>
        <Pill icon="mic" label={t.homeSpeak} ink={ink} onPress={() => router.push("/speak-list")} />
        <Pill icon="list" label={t.homeMyList} ink={ink} count={list.items.length} onPress={() => router.push("/my-list")} />
        {lastOrderId && (
          <Pill icon="refresh" label={t.homeSameAsLast} ink={ink} busy={reorder.reorderingId === lastOrderId} onPress={() => reorder.reorder(lastOrderId)} />
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
  row: { flexDirection: "row", gap: 8, marginTop: 10 },
  // Equal shares of the search bar's width; a long (Tamil) label shrinks rather than widening its pill
  pill: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.94)", borderWidth: 1,
    shadowOpacity: 0.28, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  label: { flexShrink: 1, fontSize: 13, fontFamily: fonts.bold },
  count: {
    position: "absolute", top: -7, right: -9, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3,
    backgroundColor: colors.accent, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#ffffff",
  },
  countText: { fontSize: 9.5, fontFamily: fonts.extrabold, color: colors.accentText },
});
