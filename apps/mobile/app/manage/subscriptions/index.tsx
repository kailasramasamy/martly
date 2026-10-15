import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { SelectField } from "../../../components/manage/ui/SelectField";
import { formatDate } from "../../../components/manage/ui/dates";
import { FREQUENCY_LABEL, SUBSCRIPTION_STATUS, itemsSummary, type Subscription } from "../../../components/manage/marketing/subscription-types";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useManageScope } from "../../../lib/manage-scope-context";

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "PAUSED", label: "Paused" },
  { value: "CANCELLED", label: "Cancelled" },
];
const FREQUENCY_OPTIONS = [{ value: "", label: "Any frequency" }, ...Object.entries(FREQUENCY_LABEL).map(([value, label]) => ({ value, label }))];

export default function SubscriptionsScreen() {
  const router = useRouter();
  const { storeId } = useManageScope();
  const [status, setStatus] = useState("");
  const [frequency, setFrequency] = useState("");
  const list = usePagedList<Subscription>("/api/v1/subscriptions/admin", { storeId, status, frequency });

  return (
    <ManageListScreen
      title="Subscriptions"
      list={list}
      filters={(
        <View>
          <SegmentedTabs options={STATUS_TABS} value={status} onChange={setStatus} />
          <View style={{ marginTop: 10 }}><SelectField value={frequency} options={FREQUENCY_OPTIONS} onChange={setFrequency} /></View>
        </View>
      )}
      headerRight={() => <HeaderAction icon="settings-outline" onPress={() => router.push("/manage/subscriptions/config")} accessibilityLabel="Subscription settings" />}
      empty={{ icon: "repeat-outline", title: "No subscriptions", message: "Customer auto-deliveries appear here." }}
      renderItem={(s) => {
        const tone = SUBSCRIPTION_STATUS[s.status];
        return (
          <ListRow
            title={s.user.name || s.user.phone || "Customer"}
            subtitle={`${FREQUENCY_LABEL[s.frequency] ?? s.frequency} · ${s.store.name}`}
            caption={`${itemsSummary(s.items) || "No items"} · Next ${formatDate(s.nextDeliveryDate)}`}
            railColor={tone.color}
            trailing={<StatusPill {...tone} />}
            onPress={() => router.push(`/manage/subscriptions/${s.id}`)}
            chevron
          />
        );
      }}
    />
  );
}
