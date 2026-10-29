import { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useResource } from "../../../../lib/manage/use-resource";
import { colors, fonts } from "../../../../constants/theme";
import { manage } from "../../ui/tokens";
import { ManageListScreen } from "../../ManageListScreen";
import { OrgPlanSheet } from "./OrgPlanSheet";
import { PlanOrgCard } from "./PlanOrgCard";
import type { Subscriber } from "./types";

type Filter = "ALL" | "FREE" | "GROWTH" | "PRO" | "BETA";

const FILTERS: { value: Filter; label: string; match: (o: Subscriber) => boolean }[] = [
  { value: "ALL", label: "All", match: () => true },
  { value: "FREE", label: "Free", match: (o) => !o.plan },
  { value: "GROWTH", label: "Growth", match: (o) => o.plan?.code === "GROWTH" },
  { value: "PRO", label: "Pro", match: (o) => o.plan?.code === "PRO" },
  { value: "BETA", label: "Beta settings", match: (o) => o.webStoreAlwaysOn || o.unlimitedListings },
];

/** Plan filters that double as the summary: each chip counts its stores */
function FilterChips({ orgs, value, onChange }: { orgs: Subscriber[]; value: Filter; onChange: (f: Filter) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
      {FILTERS.map((f) => {
        const active = f.value === value;
        return (
          <TouchableOpacity key={f.value} style={[styles.chip, active && styles.chipActive]} onPress={() => onChange(f.value)} accessibilityRole="button" accessibilityState={{ selected: active }}>
            <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{f.label}</Text>
            <Text style={[styles.chipCount, active && styles.chipLabelActive]}>{orgs.filter(f.match).length}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/** Every organisation's plan, with Martly's per-store settings a tap away */
export function PlansList() {
  const { data, loading, error, reload } = useResource<Subscriber[]>("/api/v1/marketing-admin/subscribers");
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selected, setSelected] = useState<Subscriber | null>(null);
  const orgs = useMemo(() => data ?? [], [data]);
  const shown = useMemo(() => {
    const match = FILTERS.find((f) => f.value === filter)!.match;
    const term = q.trim().toLowerCase();
    const haystack = (o: Subscriber) => [o.name, o.town?.name, o.town?.state].join(" ").toLowerCase();
    return orgs.filter((o) => match(o) && (!term || haystack(o).includes(term)));
  }, [orgs, filter, q]);
  const list = { items: shown, loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined };
  return (
    <>
      <ManageListScreen
        title="Store plans"
        list={list}
        search={{ value: q, onChange: setQ, placeholder: "Search store, town or state" }}
        filters={<FilterChips orgs={orgs} value={filter} onChange={setFilter} />}
        empty={{ icon: "business-outline", title: q || filter !== "ALL" ? "No stores match" : "No stores yet" }}
        renderItem={(o) => <PlanOrgCard org={o} onPress={() => setSelected(o)} />}
      />
      <OrgPlanSheet org={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8, paddingVertical: 2 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 36, paddingHorizontal: 14, borderRadius: 18, borderWidth: 1, borderColor: manage.line, backgroundColor: "#fff" },
  chipActive: { backgroundColor: colors.text, borderColor: colors.text },
  chipLabel: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  chipCount: { fontFamily: fonts.extrabold, fontSize: 13, color: colors.textSecondary },
  chipLabelActive: { color: "#fff" },
});
