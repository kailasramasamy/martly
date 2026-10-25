import { useLocalSearchParams } from "expo-router";
import { PostForm } from "../../../components/manage/store-voice/PostForm";
import { EmptyState } from "../../../components/manage/ui/EmptyState";

export default function NewStorePost() {
  const { storeId } = useLocalSearchParams<{ storeId?: string }>();
  if (!storeId) return <EmptyState icon="storefront-outline" title="Pick a store first" message="Open Shop posts and choose the store to post for." />;
  return <PostForm storeId={storeId} />;
}
