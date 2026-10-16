import { useState } from "react";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { StatusPill } from "../../../components/manage/ui/StatusPill";
import { SegmentedTabs } from "../../../components/manage/ui/SegmentedTabs";
import { STORE_STATUS, STORE_STATUS_RAIL } from "../../../components/manage/org/constants";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import type { StoreRow } from "../../../components/manage/org/types";

const STATUS_TABS = [{ value: "", label: "All" }, ...Object.entries(STORE_STATUS).map(([value, p]) => ({ value, label: p.label }))];

export default function StoresScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const allowed = can(user, "stores", "list");
  const list = usePagedList<StoreRow>("/api/v1/stores", { q, status }, { enabled: allowed });

  if (!allowed) return <ScreenNotice title="Stores" kind="denied" />;
  return (
    <ManageListScreen
      title="Stores"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search stores" }}
      filters={<SegmentedTabs options={STATUS_TABS} value={status} onChange={setStatus} />}
      headerRight={can(user, "stores", "create") ? () => <HeaderAction accessibilityLabel="Add store" onPress={() => router.push("/manage/stores/new")} /> : undefined}
      empty={{ icon: "storefront-outline", title: "No stores found", message: q || status ? "Try a different search or filter." : "Create your first store to get started." }}
      renderItem={(s) => (
        <ListRow
          title={s.name}
          subtitle={s.address}
          caption={s.organizationName}
          railColor={STORE_STATUS_RAIL[s.status]}
          trailing={<StatusPill {...STORE_STATUS[s.status]} />}
          chevron
          onPress={() => router.push(`/manage/stores/${s.id}`)}
        />
      )}
    />
  );
}
