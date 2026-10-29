import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { CreditCampaignRow } from "@martly/shared/types";
import { colors, fonts, radius } from "../../../constants/theme";
import { StatusPill } from "../ui/StatusPill";
import { formatINR, manage, tabular } from "../ui/tokens";
import { formatDate } from "../ui/dates";
import { BudgetMeter } from "./BudgetMeter";
import { STATE_TONE, campaignState } from "./describe";

interface CampaignCardProps {
  campaign: CreditCampaignRow;
  /** Name the store on cards in a list of several stores' campaigns */
  showStore: boolean;
  onPress: () => void;
}

/** One welcome-credit campaign: the amount, its terms, the budget bar and how many customers it has won */
export function CampaignCard({ campaign: c, showStore, onPress }: CampaignCardProps) {
  const state = campaignState(c);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, state !== "active" && styles.dimmed, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${formatINR(c.amount)} welcome credit${c.storeName ? ` at ${c.storeName}` : ""}, ${STATE_TONE[state].label}`}
    >
      <View style={styles.top}>
        <View>
          <Text style={styles.amount}>{formatINR(c.amount)}</Text>
          <Text style={styles.per}>per new customer</Text>
        </View>
        <StatusPill {...STATE_TONE[state]} dot={state === "active"} />
      </View>
      {showStore && c.storeName && (
        <View style={styles.store}>
          <Ionicons name="storefront-outline" size={14} color={colors.textSecondary} />
          <Text style={styles.storeName} numberOfLines={1}>{c.storeName}</Text>
        </View>
      )}
      <View style={styles.terms}>
        <Term icon="cart-outline" text={`Orders above ${formatINR(c.minOrderAmount)}`} />
        <Term icon="hourglass-outline" text={`${c.validDays} days to use`} />
        {c.endsAt && <Term icon="calendar-outline" text={`${state === "ended" ? "Ended" : "Ends"} ${formatDate(c.endsAt)}`} />}
      </View>
      <View style={styles.divider} />
      <BudgetMeter budget={c.budget} usage={c.usage} />
      <Footer campaign={c} />
    </Pressable>
  );
}

function Term({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.term}>
      <Ionicons name={icon} size={13} color={colors.primary} />
      <Text style={styles.termText}>{text}</Text>
    </View>
  );
}

function Footer({ campaign: c }: { campaign: CreditCampaignRow }) {
  const over = c.usage.possibleOverrun;
  return (
    <View style={styles.footer}>
      <Text style={styles.count}>
        <Text style={styles.countStrong}>{c.usage.usedCount}</Text> used · {c.usage.grantCount} given
      </Text>
      {over > 0 && (
        <View style={styles.warn}>
          <Ionicons name="alert-circle" size={14} color={manage.attentionText} />
          <Text style={styles.warnText}>May go {formatINR(over)} over</Text>
        </View>
      )}
      <Ionicons name="chevron-forward" size={18} color={manage.muted} style={styles.chevron} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, padding: 16, gap: 12 },
  dimmed: { opacity: 0.72 },
  pressed: { backgroundColor: manage.hairline },
  top: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  amount: { fontFamily: fonts.extrabold, fontSize: 30, color: colors.text, letterSpacing: -0.5, ...tabular },
  per: { fontFamily: fonts.medium, fontSize: 12, color: colors.textSecondary, marginTop: -2 },
  store: { flexDirection: "row", alignItems: "center", gap: 6 },
  storeName: { fontFamily: fonts.semibold, fontSize: 13, color: colors.text, flexShrink: 1 },
  terms: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  term: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: manage.tint, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  termText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.primaryDark },
  divider: { height: 1, backgroundColor: manage.hairline },
  footer: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 24 },
  count: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, ...tabular },
  countStrong: { fontFamily: fonts.bold, color: colors.text },
  warn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: manage.attentionBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  warnText: { fontFamily: fonts.semibold, fontSize: 12, color: manage.attentionText },
  chevron: { marginLeft: "auto" },
});
