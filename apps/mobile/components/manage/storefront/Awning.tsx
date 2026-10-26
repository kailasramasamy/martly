import { View, Text, StyleSheet } from "react-native";
import { STOREFRONT_GROUPS, STOREFRONT_GROUP_LABELS, type StorefrontGroup } from "@martly/shared/constants";
import { fonts } from "../../../constants/theme";
import { useBilingual } from "./storefront";

const STRIPE_HEIGHT = 46;

/** The shop's awning: one scalloped stripe per area, filled as far as that area is set up */
export function Awning({ groups }: { groups: Record<StorefrontGroup, number | null> }) {
  const text = useBilingual();
  const t = TONE;
  return (
    <View accessibilityLabel={STOREFRONT_GROUPS.map((g) => `${STOREFRONT_GROUP_LABELS[g].en} ${groups[g] ?? "not scored"}`).join(", ")}>
      <View style={[styles.rail, { backgroundColor: t.rail }]} />
      <View style={styles.stripes}>
        {STOREFRONT_GROUPS.map((g, i) => {
          const value = groups[g];
          return (
            <View key={g} style={[styles.stripe, { backgroundColor: i % 2 ? t.empty : t.emptyAlt }]}>
              <View style={[styles.fill, { height: `${value ?? 0}%`, backgroundColor: i % 2 ? t.fill : t.fillAlt }]} />
            </View>
          );
        })}
      </View>
      <View style={styles.labels}>
        {STOREFRONT_GROUPS.map((g) => (
          <View key={g} style={styles.labelCell}>
            <Text style={[styles.value, { color: t.value }]}>{groups[g] ?? "–"}</Text>
            <Text style={[styles.label, { color: t.label }]} numberOfLines={2}>{text(STOREFRONT_GROUP_LABELS[g])}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// Light stripes on the ink band
const TONE = {
  rail: "#e6f4f1", empty: "rgba(255,255,255,0.08)", emptyAlt: "rgba(255,255,255,0.14)",
  fill: "#2dd4bf", fillAlt: "#fbbf24", value: "#ffffff", label: "#8fb5ae",
} as const;

const styles = StyleSheet.create({
  rail: { height: 5, borderRadius: 3 },
  stripes: { flexDirection: "row", gap: 3 },
  stripe: {
    flex: 1, height: STRIPE_HEIGHT, borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
    overflow: "hidden",
  },
  fill: { position: "absolute", top: 0, left: 0, right: 0 },
  value: { fontFamily: fonts.extrabold, fontSize: 15, fontVariant: ["tabular-nums"] },
  labels: { flexDirection: "row", gap: 3, marginTop: 6 },
  labelCell: { flex: 1, alignItems: "center" },
  label: { textAlign: "center", fontFamily: fonts.semibold, fontSize: 10.5, lineHeight: 13 },
});
