import { useLocalSearchParams } from "expo-router";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { PostForm, type EditablePost } from "../../../components/manage/store-voice/PostForm";
import { useResource } from "../../../lib/manage/use-resource";

type Loaded = EditablePost & { storeId: string };

export default function EditStorePost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useResource<Loaded>(`/api/v1/store-voice/posts/${id}`);
  if (!data) return <ManageStackScreen title="Edit post" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
  return <PostForm storeId={data.storeId} existing={data} />;
}
