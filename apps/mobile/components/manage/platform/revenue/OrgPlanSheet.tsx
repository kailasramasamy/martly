import { useEffect, useState } from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../../../lib/api";
import { useAction } from "../../../../lib/manage/use-action";
import { useToast } from "../../../../lib/toast-context";
import { colors, fonts, radius } from "../../../../constants/theme";
import { BottomSheet } from "../../../search/BottomSheet";
import { manage } from "../../ui/tokens";
import { Logo, PLAN_STYLE } from "./PlanOrgCard";
import { GivePlanSection, type PlanCode } from "./GivePlanSection";
import { formatDate, type Subscriber } from "./types";

type Flag = "webStoreAlwaysOn" | "unlimitedListings";

const SETTINGS: { flag: Flag; icon: keyof typeof Ionicons.glyphMap; tone: { bg: string; fg: string }; label: string; description: string }[] = [
  { flag: "webStoreAlwaysOn", icon: "globe-outline", tone: { bg: "#dbeafe", fg: "#1d4ed8" }, label: "Always on martlyshop.in", description: "Stays on whatever the plan" },
  { flag: "unlimitedListings", icon: "infinite-outline", tone: { bg: "#ede9fe", fg: "#6d28d9" }, label: "Unlimited products", description: "No limit on own products" },
];

function Header({ org }: { org: Subscriber }) {
  const plan = PLAN_STYLE[org.plan?.code ?? "FREE"] ?? PLAN_STYLE.FREE;
  return (
    <View style={styles.header}>
      <Logo org={org} />
      <View style={styles.headerText}>
        {org.town ? <Text style={styles.place}>{`${org.town.name}, ${org.town.state}`}</Text> : null}
        <View style={styles.planRow}>
          <Text style={[styles.plan, { backgroundColor: plan.bg, color: plan.fg }]}>{org.plan?.name ?? "Free"}</Text>
          {org.plan ? <Text style={styles.until}>{`until ${formatDate(org.currentUntil)}`}</Text> : null}
        </View>
      </View>
    </View>
  );
}

/** Martly's settings for one organisation: the beta switches, and a plan given without payment */
export function OrgPlanSheet({ org, onClose, onChanged }: { org: Subscriber | null; onClose: () => void; onChanged: () => void }) {
  const { run, running } = useAction();
  const toast = useToast();
  const [flags, setFlags] = useState({ webStoreAlwaysOn: false, unlimitedListings: false });

  useEffect(() => {
    if (org) setFlags({ webStoreAlwaysOn: org.webStoreAlwaysOn, unlimitedListings: org.unlimitedListings });
  }, [org]);

  const toggle = async (flag: Flag, value: boolean) => {
    const done = await run(() => api.patch(`/api/v1/marketing-admin/organizations/${org?.id}`, { [flag]: value }), "Saved");
    if (!done) return;
    setFlags((f) => ({ ...f, [flag]: value }));
    onChanged();
  };

  const give = async (productCode: PlanCode, days: number) => {
    const res = await run(() => api.post<{ endsAt: string; plan: { name: string } }>(`/api/v1/marketing-admin/organizations/${org?.id}/plan`, { productCode, days }));
    if (!res) return;
    toast.show(`${res.data.plan.name} given until ${formatDate(res.data.endsAt)}`, "success");
    onChanged();
    onClose();
  };

  return (
    <BottomSheet scrollable visible={!!org} title={org?.name ?? ""} onClose={onClose}>
      {org ? (
        <View style={styles.body}>
          <Header org={org} />
          <Text style={styles.heading}>Beta settings</Text>
          <View style={styles.group}>
            {SETTINGS.map((s) => (
              <View key={s.flag} style={styles.setting}>
                <View style={[styles.icon, { backgroundColor: s.tone.bg }]}><Ionicons name={s.icon} size={18} color={s.tone.fg} /></View>
                <View style={styles.settingText}>
                  <Text style={styles.label}>{s.label}</Text>
                  <Text style={styles.description}>{s.description}</Text>
                </View>
                <Switch value={flags[s.flag]} onValueChange={(v) => toggle(s.flag, v)} disabled={running} trackColor={{ true: colors.primary, false: manage.line }} accessibilityLabel={s.label} />
              </View>
            ))}
          </View>
          <GivePlanSection running={running} onGive={give} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: 14, paddingBottom: 8 },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerText: { flex: 1, gap: 6 },
  place: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  planRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  plan: { fontFamily: fonts.extrabold, fontSize: 12, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, overflow: "hidden" },
  until: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  heading: { fontFamily: fonts.bold, fontSize: 11, color: colors.textSecondary, letterSpacing: 0.9, textTransform: "uppercase", marginTop: 6 },
  group: { backgroundColor: colors.surface, borderRadius: radius.lg, paddingHorizontal: 12, paddingVertical: 6, gap: 4 },
  setting: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 8 },
  icon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  settingText: { flex: 1 },
  label: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  description: { fontFamily: fonts.medium, fontSize: 12.5, color: colors.textSecondary, marginTop: 2 },
});
