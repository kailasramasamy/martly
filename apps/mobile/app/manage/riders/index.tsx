import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { SectionCard } from "../../../components/manage/ui/SectionCard";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { EmptyState } from "../../../components/manage/ui/EmptyState";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { useStoreScope } from "../../../components/manage/StoreScope";
import { useRefreshOnFocus } from "../../../lib/manage/use-refresh-on-focus";
import type { Rider } from "../../../components/manage/delivery/types";

const BUSY = { label: "On a trip", color: "#6d28d9", bg: "#ede9fe" };

export default function RidersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ routeParam: true, placeholder: "Choose a store", showOrg: true });
  const { data, loading, error, reload } = useResource<Rider[]>(storeId ? `/api/v1/riders?storeId=${storeId}` : null);
  useRefreshOnFocus(reload);

  if (!can(user?.role ?? "", "riders", "list")) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Only store managers and admins can manage riders." />;
  }
  const add = () => router.push(`/manage/riders/new?storeId=${storeId}`);

  return (
    <ManageStackScreen
      title="Riders"
      loading={!!storeId && loading}
      error={error}
      onRetry={reload}
      headerRight={storeId ? () => <HeaderAction label="Add" onPress={add} /> : undefined}
    >
      {picker}
      {storeId && data && data.length === 0 && (
        <EmptyState icon="bicycle-outline" title="No riders yet" message="Add a rider to start dispatching delivery trips." action={{ label: "Add rider", onPress: add }} />
      )}
      {data && data.length > 0 && (
        <SectionCard title={`${data.length} rider${data.length === 1 ? "" : "s"}`} flush>
          {data.map((r) => (
            <ListRow
              key={r.id}
              icon="bicycle-outline"
              title={r.name}
              subtitle={r.phone ?? r.email}
              caption={`${r.tripStats.completed} completed · ${r.tripStats.total} total trips`}
              trailing={r.tripStats.active > 0 ? <StatusPill {...BUSY} label={`${r.tripStats.active} active`} /> : undefined}
              onPress={() => router.push(`/manage/riders/${r.id}?storeId=${storeId}`)}
              chevron
            />
          ))}
        </SectionCard>
      )}
    </ManageStackScreen>
  );
}
