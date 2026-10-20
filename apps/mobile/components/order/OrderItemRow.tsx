import { View, Text, Image, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { RefuseReason } from "@martly/shared/constants";
import { colors, spacing, fontSize } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import type { Translations } from "../../lib/types";
import { replacementNote } from "./replacement-copy";

export interface OrderLine {
  id: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  refusedQuantity?: number;
  refusedReason?: RefuseReason | null;
  replacesReturnId?: string | null;
  replacesReturn?: { orderId: string; reason: string } | null;
  product: { name: string; imageUrl?: string | null; translations?: Translations | null };
  variant?: { name: string; imageUrl?: string | null } | null;
}

export function OrderItemRow({ item, returnTag }: { item: OrderLine; returnTag?: string }) {
  const t = useStrings("orders").item;
  const { getLocalizedName } = useLanguage();
  const imageUrl = item.variant?.imageUrl || item.product.imageUrl;
  const refused = item.refusedQuantity ?? 0;
  return (
    <View style={styles.row}>
      <View style={styles.thumb}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.thumbImage} resizeMode="contain" />
        ) : (
          <Ionicons name="cube-outline" size={18} color="#94a3b8" />
        )}
      </View>
      <View style={styles.info}>
        <Text style={styles.name} numberOfLines={2}>{getLocalizedName(item.product)}</Text>
        {item.variant && <Text style={styles.variant}>{item.variant.name}</Text>}
        {item.replacesReturn ? (
          <>
            <Text style={styles.qty}>{t.qty(item.quantity)}</Text>
            <View style={styles.freePill}>
              <Text style={styles.freePillText}>{t.replacement}</Text>
            </View>
            <Text style={styles.replacesNote}>{replacementNote(item.replacesReturn.reason, item.replacesReturn.orderId)}</Text>
          </>
        ) : (
          <Text style={styles.qty}>{item.quantity} {"×"} {"₹"}{Number(item.unitPrice).toFixed(0)}</Text>
        )}
        {returnTag && (
          <View style={styles.returnPill}>
            <Text style={styles.returnPillText}>{returnTag}</Text>
          </View>
        )}
        {refused > 0 && (
          <Text style={styles.refused}>
            {t.handedBack(refused, item.refusedReason ? t.refuseReasons[item.refusedReason] : undefined)}
          </Text>
        )}
      </View>
      <View style={styles.priceCol}>
        <Text style={styles.price}>{"₹"}{Number(item.totalPrice).toFixed(0)}</Text>
        {item.replacesReturn && <Text style={styles.paidEarlier}>{t.paidEarlier}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  thumb: {
    width: 52, height: 52, borderRadius: 10, backgroundColor: "#f8fafc",
    padding: 3, alignItems: "center", justifyContent: "center", overflow: "hidden",
  },
  thumbImage: { width: "100%", height: "100%", mixBlendMode: "multiply" },
  info: { flex: 1 },
  name: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  variant: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 1 },
  qty: { fontSize: fontSize.sm, color: colors.textSecondary, marginTop: 2 },
  priceCol: { alignItems: "flex-end" },
  price: { fontSize: fontSize.md, fontWeight: "600", color: colors.text },
  paidEarlier: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  replacesNote: { fontSize: fontSize.sm, color: "#166534", marginTop: 4 },
  returnPill: {
    alignSelf: "flex-start", marginTop: 4, paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 6, backgroundColor: "#f0fdfa",
  },
  returnPillText: { fontSize: 11, fontWeight: "600", color: colors.primary },
  freePill: {
    alignSelf: "flex-start",
    backgroundColor: "#dcfce7",
    borderRadius: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginTop: 4,
  },
  freePillText: { fontSize: 11, fontWeight: "700", color: "#15803d" },
  refused: { fontSize: fontSize.sm, color: colors.warning, fontWeight: "600", marginTop: 4 },
});
