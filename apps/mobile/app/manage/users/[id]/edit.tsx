import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../../lib/manage/use-resource";
import { useAuth } from "../../../../lib/auth-context";
import { ManageStackScreen } from "../../../../components/manage/ManageStackScreen";
import { UserForm } from "../../../../components/manage/org/UserForm";
import type { UserDetail } from "../../../../components/manage/org/types";

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: me } = useAuth();
  const user = useResource<UserDetail>(`/api/v1/users/${id}`);
  // Members not yet in this organization (or edited by a super admin) have no add-ons to load
  const access = useResource<{ addOns: string[] }>(me?.role === "SUPER_ADMIN" ? null : `/api/v1/users/${id}/permissions`);
  if (!user.data || access.loading) {
    return <ManageStackScreen title="User" loading={user.loading || access.loading} error={user.error} onRetry={user.reload}>{null}</ManageStackScreen>;
  }
  return <UserForm user={user.data} addOns={access.data?.addOns} />;
}
