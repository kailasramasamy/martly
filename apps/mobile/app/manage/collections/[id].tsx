import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { CollectionForm } from "../../../components/manage/collections/CollectionForm";
import { CollectionView } from "../../../components/manage/collections/CollectionView";
import type { CollectionDetail } from "../../../components/manage/collections/types";

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<CollectionDetail>(`/api/v1/collections/${id}`);
  const owned = user?.role === "SUPER_ADMIN" || (!!data && data.organizationId === user?.organizationId);

  if (data && owned && can(user, "collections", "edit")) return <CollectionForm collection={data} />;
  return (
    <ManageStackScreen title={data?.title ?? "Collection"} loading={loading} error={error} onRetry={reload}>
      {data && <CollectionView collection={data} />}
    </ManageStackScreen>
  );
}
