import { useState } from "react";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { SwitchRow } from "../../../components/manage/ui/SwitchRow";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { TONES } from "../../../components/manage/marketing/common";
import { StoreSubscriptionSheet } from "../../../components/manage/marketing/StoreSubscriptionSheet";
import type { StoreSubscriptionConfig, SubscriptionConfigData } from "../../../components/manage/marketing/subscription-types";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { toQuery } from "../../../lib/manage/query";
import { useManageScope } from "../../../lib/manage-scope-context";

function StoresCard({ stores, orgEnabled, onSelect }: { stores: StoreSubscriptionConfig[]; orgEnabled: boolean; onSelect: (s: StoreSubscriptionConfig) => void }) {
  return (
    <SectionCard title="Stores" flush>
      {orgEnabled ? stores.map((s) => {
        const tone = s.subscriptionEnabled ? TONES.green : TONES.slate;
        return (
          <ListRow
            key={s.id}
            title={s.name}
            subtitle={s.subscriptionEnabled ? `${s.subscriptionDeliveryMode === "DEDICATED" ? "Dedicated window" : "Regular slots"} \u00B7 cutoff ${s.subscriptionCutoffTime}` : undefined}
            railColor={tone.color}
            trailing={<StatusPill label={s.subscriptionEnabled ? "On" : "Off"} {...tone} />}
            onPress={() => onSelect(s)}
            chevron
          />
        );
      }) : <EmptyState icon="repeat-outline" title="Subscriptions are off" message="Enable subscriptions for the organization to configure stores." />}
    </SectionCard>
  );
}

export default function SubscriptionConfigScreen() {
  const { organizationId } = useManageScope();
  const query = toQuery({ organizationId });
  const { data, setData, loading, error, reload } = useResource<SubscriptionConfigData>(organizationId ? `/api/v1/subscriptions/config${query}` : null);
  const { run, running } = useAction();
  const [selected, setSelected] = useState<StoreSubscriptionConfig | null>(null);

  if (!organizationId) {
    return <ManageStackScreen title="Subscription settings"><EmptyState icon="storefront-outline" title="Pick a store" message="Choose a store from the switcher on a tab to edit its organization's subscription settings." /></ManageStackScreen>;
  }

  const toggleOrg = async (value: boolean) => {
    const res = await run(() => api.patch(`/api/v1/subscriptions/config/org${query}`, { subscriptionEnabled: value }), value ? "Subscriptions enabled" : "Subscriptions disabled");
    if (res && data) setData({ ...data, organization: { ...data.organization, subscriptionEnabled: value } });
  };

  const saved = (store: StoreSubscriptionConfig) => {
    if (data) setData({ ...data, stores: data.stores.map((s) => (s.id === store.id ? { ...s, ...store } : s)) });
    setSelected(null);
  };

  const orgEnabled = data?.organization.subscriptionEnabled ?? false;
  return (
    <ManageStackScreen title="Subscription settings" loading={loading} error={error} onRetry={reload} onRefresh={reload}>
      {data ? (
        <>
          <SectionCard title={data.organization.name}>
            <SwitchRow label="Enable subscriptions" description="Customers can set up recurring deliveries" value={orgEnabled} onValueChange={toggleOrg} disabled={running} />
          </SectionCard>
          <StoresCard stores={data.stores} orgEnabled={orgEnabled} onSelect={setSelected} />
        </>
      ) : null}
      <StoreSubscriptionSheet store={selected} onClose={() => setSelected(null)} onSaved={saved} />
    </ManageStackScreen>
  );
}
