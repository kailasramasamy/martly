import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { STOREFRONT_CHECKS } from "@martly/shared/constants";
import type { StorefrontCheckResult } from "@martly/shared/types";
import { colors, fonts } from "../../../constants/theme";
import { manage } from "../ui/tokens";
import { StatusPill } from "../ui/StatusPill";
import { CHECK_STATUS, useBilingual } from "./storefront";

const ICONS = { ON: "checkmark-circle", PARTIAL: "ellipse-outline", STALE: "time-outline", OFF: "add-circle-outline", NA: "remove-circle-outline" } as const;

// "2 of 3", or "3 of 5 cards ready" for the hero carousel
function progress(c: StorefrontCheckResult) {
  if (c.cards) return `${c.cards.filter((x) => x.ready).length} of ${c.cards.length} cards ready`;
  if (c.have !== undefined && c.need !== undefined && c.have < c.need) return `${c.have} of ${c.need}`;
  return null;
}

/** One check: what it is and where it stands; tapping opens the guide at it, or its screen when it's done */
export function CheckRow({ check, onPress }: { check: StorefrontCheckResult; onPress?: () => void }) {
  const text = useBilingual();
  const meta = STOREFRONT_CHECKS[check.key];
  const status = check.underperforming ? { label: "Not working", color: "#c2410c", bg: "#ffedd5" } : CHECK_STATUS[check.status];
  const detail = progress(check);
  return (
    <TouchableOpacity style={styles.row} onPress={onPress} disabled={!onPress} activeOpacity={0.75} accessibilityRole="button">
      <Ionicons name={ICONS[check.status]} size={22} color={check.status === "ON" && !check.underperforming ? "#16a34a" : status.color} />
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{text(meta.title)}</Text>
        <Text style={styles.what} numberOfLines={2}>{text(meta.what)}</Text>
        {detail && <Text style={styles.detail}>{detail}</Text>}
      </View>
      <StatusPill {...status} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: manage.line, minHeight: 56,
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontFamily: fonts.bold, fontSize: 15, color: colors.text },
  what: { fontFamily: fonts.medium, fontSize: 12.5, lineHeight: 17, color: colors.textSecondary, marginTop: 2 },
  detail: { fontFamily: fonts.bold, fontSize: 12, color: manage.attentionText, marginTop: 4 },
});
