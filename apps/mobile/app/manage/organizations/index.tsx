import { useState } from "react";
import { useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth-context";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { ManageListScreen } from "../../../components/manage/ManageListScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ListRow } from "../../../components/manage/ui/ListRow";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import type { OrganizationRow } from "../../../components/manage/org/types";

export default function OrganizationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const allowed = user?.role === "SUPER_ADMIN";
  const list = usePagedList<OrganizationRow>("/api/v1/organizations", { q }, { enabled: allowed });

  if (!allowed) return <ScreenNotice title="Organizations" kind="denied" />;
  return (
    <ManageListScreen
      title="Organizations"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search organizations" }}
      headerRight={() => <HeaderAction accessibilityLabel="Add organization" onPress={() => router.push("/manage/organizations/new")} />}
      empty={{ icon: "business-outline", title: "No organizations", message: q ? "Try a different search." : "Create the first organization." }}
      renderItem={(o) => <ListRow title={o.name} subtitle={o.slug} icon="business-outline" chevron onPress={() => router.push(`/manage/organizations/${o.id}`)} />}
    />
  );
}
