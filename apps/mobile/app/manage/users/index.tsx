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
import { ROLE_PILL, ALL_ROLES } from "../../../components/manage/org/constants";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import type { UserRow } from "../../../components/manage/org/types";

const ROLE_TABS = [{ value: "", label: "All" }, ...ALL_ROLES.map((value) => ({ value, label: ROLE_PILL[value].label }))];

function storeSummary(u: UserRow): string {
  if (u.role === "SUPER_ADMIN") return "All stores";
  const names = u.userStores.map((us) => us.store.name);
  return names.length ? names.join(", ") : "No stores assigned";
}

export default function UsersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const [q, setQ] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const allowed = can(user, "users", "list");
  const list = usePagedList<UserRow>("/api/v1/users", { q, role: roleFilter }, { enabled: allowed });
  const tabs = role === "SUPER_ADMIN" ? ROLE_TABS : ROLE_TABS.filter((t) => t.value !== "SUPER_ADMIN");

  if (!allowed) return <ScreenNotice title="Team & users" kind="denied" />;
  return (
    <ManageListScreen
      title="Team & users"
      list={list}
      search={{ value: q, onChange: setQ, placeholder: "Search by name or email" }}
      filters={<SegmentedTabs options={tabs} value={roleFilter} onChange={setRoleFilter} />}
      headerRight={can(user, "users", "create") ? () => <HeaderAction accessibilityLabel="Add user" onPress={() => router.push("/manage/users/new")} /> : undefined}
      empty={{ icon: "people-outline", title: "No team members", message: q || roleFilter ? "Try a different search or filter." : "Add your first team member." }}
      renderItem={(u) => (
        <ListRow
          title={u.name}
          subtitle={u.email}
          caption={storeSummary(u)}
          trailing={<StatusPill {...ROLE_PILL[u.role]} />}
          chevron
          onPress={() => router.push(`/manage/users/${u.id}`)}
        />
      )}
    />
  );
}
