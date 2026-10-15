import { View, Text, StyleSheet } from "react-native";
import { colors, fonts } from "../../../constants/theme";
import { formatDate } from "../ui/dates";
import { manage } from "../ui/tokens";
import { Stars } from "./Stars";
import type { StoreRatingRecord } from "./types";

function SubRating({ label, value }: { label: string; value: number | null }) {
  if (value == null) return null;
  return (
    <View style={styles.sub}>
      <Text style={styles.subLabel}>{label}</Text>
      <Stars value={value} size={11} />
    </View>
  );
}

export function StoreRatingRow({ rating: r }: { rating: StoreRatingRecord }) {
  return (
    <View style={styles.row}>
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.store} numberOfLines={1}>{r.store.name}</Text>
          <Text style={styles.meta}>{r.user.name} · {formatDate(r.createdAt)}</Text>
        </View>
        <Stars value={r.overallRating} />
      </View>
      {(r.deliveryRating != null || r.packagingRating != null) && (
        <View style={styles.subs}>
          <SubRating label="Delivery" value={r.deliveryRating} />
          <SubRating label="Packaging" value={r.packagingRating} />
        </View>
      )}
      {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: manage.card, borderBottomWidth: 1, borderBottomColor: manage.hairline, padding: 14, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headText: { flex: 1, minWidth: 0 },
  store: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  subs: { flexDirection: "row", gap: 16 },
  sub: { flexDirection: "row", alignItems: "center", gap: 6 },
  subLabel: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary },
  comment: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 20, color: colors.text },
});
