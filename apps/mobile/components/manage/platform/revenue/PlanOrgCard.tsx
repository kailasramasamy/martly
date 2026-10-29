import { useState } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts, radius } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { formatDate, type Subscriber } from "./types";

const LOGO = 52;

export const PLAN_STYLE: Record<string, { bg: string; fg: string }> = {
  PRO: { bg: colors.primaryDark, fg: "#fff" },
  GROWTH: { bg: "#ccfbf1", fg: colors.primaryDark },
  FREE: { bg: "#f1f5f9", fg: "#475569" },
};

const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export function Logo({ org }: { org: Subscriber }) {
  const [failed, setFailed] = useState(false);
  if (org.logoUrl && !failed) {
    return (
      <View style={styles.logo}>
        <Image source={{ uri: org.logoUrl }} style={styles.logoImage} resizeMode="contain" onError={() => setFailed(true)} />
      </View>
    );
  }
  return <View style={[styles.logo, styles.initialsPlate]}><Text style={styles.initials}>{initials(org.name)}</Text></View>;
}

function Chip({ icon, label, tone }: { icon: keyof typeof Ionicons.glyphMap; label: string; tone: { bg: string; fg: string } }) {
  return (
    <View style={[styles.chip, { backgroundColor: tone.bg }]}>
      <Ionicons name={icon} size={13} color={tone.fg} />
      <Text style={[styles.chipText, { color: tone.fg }]}>{label}</Text>
    </View>
  );
}

/** Town and state, and the store count when the organisation has more than one */
function placeLine(o: Subscriber) {
  const place = o.town ? `${o.town.name}, ${o.town.state}` : "No town yet";
  return o.stores > 1 ? `${place} · ${o.stores} stores` : place;
}

/** One organisation on the platform's Store plans list: who they are, their plan, and Martly's switches */
export function PlanOrgCard({ org, onPress }: { org: Subscriber; onPress: () => void }) {
  const code = org.plan?.code ?? "FREE";
  const plan = PLAN_STYLE[code] ?? PLAN_STYLE.FREE;
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${org.name}, ${org.plan?.name ?? "Free"} plan`}>
      <View style={styles.top}>
        <Logo org={org} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={2}>{org.name}</Text>
          <Text style={styles.meta}>{placeLine(org)}</Text>
        </View>
        <Text style={[styles.plan, { backgroundColor: plan.bg, color: plan.fg }]}>{org.plan?.name ?? "Free"}</Text>
        <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
      </View>
      {org.plan || org.webStoreAlwaysOn || org.unlimitedListings ? <View style={styles.footer}>
        {org.plan ? (
          <>
            <Ionicons name="calendar-outline" size={14} color={colors.textSecondary} />
            <Text style={styles.until}>{`Until ${formatDate(org.currentUntil)}`}</Text>
          </>
        ) : null}
        <View style={styles.chips}>
          {org.webStoreAlwaysOn ? <Chip icon="globe-outline" label="Always on web" tone={{ bg: "#dbeafe", fg: "#1d4ed8" }} /> : null}
          {org.unlimitedListings ? <Chip icon="infinite-outline" label="Unlimited" tone={{ bg: "#ede9fe", fg: "#6d28d9" }} /> : null}
        </View>
      </View> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: manage.card, borderRadius: radius.lg, borderWidth: 1, borderColor: manage.line, marginHorizontal: 16, marginTop: 12, padding: 14 },
  top: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: LOGO, height: LOGO, borderRadius: 14, borderWidth: 1, borderColor: manage.line, backgroundColor: "#fff", padding: 5, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  logoImage: { width: "100%", height: "100%" },
  initialsPlate: { backgroundColor: colors.primary, borderColor: colors.primary },
  initials: { fontFamily: fonts.extrabold, fontSize: 18, color: "#fff" },
  body: { flex: 1 },
  name: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  plan: { fontFamily: fonts.extrabold, fontSize: 12, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, overflow: "hidden" },
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 10, paddingLeft: 62 },
  until: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary, marginRight: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: fonts.bold, fontSize: 11 },
});
