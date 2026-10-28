import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PriceReviewGroup } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { manage, tabular } from "../ui/tokens";
import { Button } from "../ui/Button";

interface Props {
  group: PriceReviewGroup;
  /** Brands show a logo tile; aisles a photo */
  logo: boolean;
  onReview: () => void;
  onAllOk: () => void;
  onMore: () => void;
}

/** A brand or aisle to settle at once: its progress, the usual discount, and one-tap "all OK" */
export function GroupCard({ group, logo, onReview, onAllOk, onMore }: Props) {
  const done = group.total - group.pending;
  const usual = group.typicalOffPct === null ? "No MRP" : group.typicalOffPct <= 0 ? "Usually at MRP" : `Usually ${group.typicalOffPct}% below MRP`;
  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.head} onPress={onReview} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`Review ${group.name}`}>
        {group.imageUrl
          ? <Image source={{ uri: group.imageUrl }} style={[styles.thumb, logo && styles.logo]} resizeMode={logo ? "contain" : "cover"} />
          : <View style={[styles.thumb, styles.initial]}><Text style={styles.initialText}>{group.name.slice(0, 1)}</Text></View>}
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{group.name}</Text>
          <Text style={[styles.meta, tabular]} numberOfLines={1}>
            {group.pending === 0 ? "All checked" : `${group.pending} of ${group.total} to check`} · {usual}
          </Text>
          <View style={styles.track}><View style={[styles.fill, { flex: done }]} /><View style={{ flex: group.pending }} /></View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={manage.muted} />
      </TouchableOpacity>
      {group.pending > 0 && (
        <View style={styles.actions}>
          <Button label={`All ${group.pending} OK`} icon="checkmark-done" compact onPress={onAllOk} style={styles.grow} />
          <Button label="Review" variant="secondary" compact onPress={onReview} style={styles.grow} />
          <TouchableOpacity style={styles.more} onPress={onMore} accessibilityRole="button" accessibilityLabel={`More for ${group.name}`}>
            <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, marginHorizontal: 16, padding: 12, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  thumb: { width: 48, height: 48, borderRadius: radius.md, backgroundColor: manage.hairline },
  logo: { backgroundColor: manage.card, borderWidth: 1, borderColor: manage.hairline },
  initial: { alignItems: "center", justifyContent: "center", backgroundColor: manage.tint },
  initialText: { fontFamily: fonts.extrabold, fontSize: 18, color: colors.primary },
  body: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary },
  track: { flexDirection: "row", height: 4, borderRadius: 2, overflow: "hidden", backgroundColor: manage.hairline, marginTop: 2 },
  fill: { backgroundColor: colors.primary },
  actions: { flexDirection: "row", gap: 8 },
  grow: { flex: 1 },
  more: { width: 44, height: 36, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, alignItems: "center", justifyContent: "center" },
});
