import { View, Text, StyleSheet } from "react-native";
import { Button } from "../ui/Button";
import { formatINR, manage, tabular } from "../ui/tokens";
import { colors, fonts, radius } from "../../../constants/theme";
import type { AdProduct } from "./plan-types";

interface Props {
  packs: AdProduct[];
  canBuy: boolean;
  /** The pack being bought, whose button spins */
  pendingId: string | null;
  /** Another purchase is running: the others waits, without spinning */
  locked: boolean;
  onBuy: (pack: AdProduct) => void;
}

const perImage = (p: AdProduct) => p.price / p.aiImageCredits;

/** AI-image packs: how many images, the price before GST and the price per image, each with a Buy button */
export function ImagePackList({ packs, canBuy, pendingId, locked, onBuy }: Props) {
  const cheapest = Math.min(...packs.map(perImage));
  return (
    <View style={styles.list}>
      {packs.map((p) => (
        <View key={p.id} style={styles.row}>
          <View style={styles.count}>
            <Text style={[styles.countNum, tabular]}>{p.aiImageCredits}</Text>
            <Text style={styles.countLabel}>images</Text>
          </View>
          <View style={styles.info}>
            <Text style={styles.price}>{`${formatINR(p.price)} + GST`}</Text>
            <Text style={[styles.muted, tabular]}>{`${formatINR(perImage(p), { decimals: true })} an image`}</Text>
            {packs.length > 1 && perImage(p) === cheapest ? <Text style={styles.best}>Best value</Text> : null}
          </View>
          <Button label="Buy" onPress={() => onBuy(p)} disabled={!canBuy || locked} loading={pendingId === p.id} style={styles.buy} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, padding: 10, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, backgroundColor: "#fff" },
  count: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: manage.tint, alignItems: "center", justifyContent: "center" },
  countNum: { fontFamily: fonts.extrabold, fontSize: 24, color: colors.primary, lineHeight: 28 },
  countLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.primary },
  info: { flex: 1 },
  price: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  muted: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  best: { fontFamily: fonts.extrabold, fontSize: 11, letterSpacing: 0.6, color: manage.attentionText, marginTop: 4 },
  buy: { minWidth: 72 },
});
