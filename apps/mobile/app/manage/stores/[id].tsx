import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { StoreEditor } from "../../../components/manage/org/StoreEditor";
import { ScreenNotice } from "../../../components/manage/delivery-config/ScreenNotice";
import type { StoreDetail } from "../../../components/manage/org/types";

export default function StoreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const store = useResource<StoreDetail>(`/api/v1/stores/${id}`);
  if (!can(user?.role ?? "", "stores", "show")) return <ScreenNotice title="Store" kind="denied" />;
  if (!store.data) return <ManageStackScreen title="Store" loading={store.loading} error={store.error} onRetry={store.reload}>{null}</ManageStackScreen>;
  return <StoreEditor key={store.data.updatedAt} store={store.data} onReload={store.reload} />;
}
