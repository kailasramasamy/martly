import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { UserForm } from "../../../components/manage/org/UserForm";
import type { UserDetail } from "../../../components/manage/org/types";

export default function EditUserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const user = useResource<UserDetail>(`/api/v1/users/${id}`);
  if (!user.data) return <ManageStackScreen title="User" loading={user.loading} error={user.error} onRetry={user.reload}>{null}</ManageStackScreen>;
  return <UserForm user={user.data} />;
}
