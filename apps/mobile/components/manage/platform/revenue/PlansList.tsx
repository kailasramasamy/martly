import { useResource } from "../../../../lib/manage/use-resource";
import { ManageListScreen } from "../../ManageListScreen";
import { ListRow } from "../../ui/ListRow";
import { TONES } from "../../marketing/common";
import { formatDate, type Subscriber } from "./types";

export function PlansList({ switcher }: { switcher: React.ReactNode }) {
  const { data, loading, error, reload } = useResource<Subscriber[]>("/api/v1/marketing-admin/subscribers");
  const list = { items: data ?? [], loading, refreshing: false, loadingMore: false, error, refresh: reload, loadMore: () => undefined };
  return (
    <ManageListScreen
      title="Marketing revenue"
      list={list}
      filters={switcher}
      empty={{ icon: "business-outline", title: "No organizations" }}
      renderItem={(s) => (
        <ListRow
          title={s.name}
          subtitle={`Current period ends ${formatDate(s.currentUntil)}`}
          caption={`Paid through ${formatDate(s.paidThrough)}`}
          status={s.plan ? { label: s.plan.name, ...TONES.green } : { label: "Free", ...TONES.slate }}
        />
      )}
    />
  );
}
