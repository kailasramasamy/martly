import { useState } from "react";
import { View, StyleSheet } from "react-native";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { StatusPill } from "../../ui/StatusPill";
import { TONES } from "../../marketing/common";
import { OrgPlanSheet } from "./OrgPlanSheet";
import { formatDate, type Subscriber } from "./types";

/** Every organisation's plan, with Martly's per-store settings a tap away */
export function PlansList() {
  const { data, loading, error, reload } = useResource<Subscriber[]>("/api/v1/marketing-admin/subscribers");
  const list = { items: data ?? [], loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined };
  const [selected, setSelected] = useState<Subscriber | null>(null);
  return (
    <>
      <ManageListScreen
        title="Store plans"
        list={list}
        empty={{ icon: "business-outline", title: "No organizations" }}
        renderItem={(s) => (
          <ListRow
            title={s.name}
            subtitle={`Current period ends ${formatDate(s.currentUntil)}`}
            caption={`Paid through ${formatDate(s.paidThrough)}`}
            status={s.plan ? { label: s.plan.name, ...TONES.green } : { label: "Free", ...TONES.slate }}
            trailing={<BetaPills org={s} />}
            chevron
            onPress={() => setSelected(s)}
          />
        )}
      />
      <OrgPlanSheet org={selected} onClose={() => setSelected(null)} onChanged={reload} />
    </>
  );
}

function BetaPills({ org }: { org: Subscriber }) {
  if (!org.webStoreAlwaysOn && !org.unlimitedListings) return null;
  return (
    <View style={styles.pills}>
      {org.webStoreAlwaysOn ? <StatusPill label="Always on web" {...TONES.blue} /> : null}
      {org.unlimitedListings ? <StatusPill label="Unlimited products" {...TONES.violet} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ pills: { gap: 4, alignItems: "flex-end" } });
