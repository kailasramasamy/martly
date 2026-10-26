import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "../../../lib/api";
import { useAction } from "../../../lib/manage/use-action";
import { PostForm, type PostSeed } from "../../../components/manage/store-voice/PostForm";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { EmptyState } from "../../../components/manage/ui/EmptyState";

type PostDraft = Omit<PostSeed, "translations"> & { translations: { ta: { text: string } } };

// With `ai`, the form opens on an AI draft about what's new or fresh; nothing posts until the owner taps Post
function useAiSeed(storeId: string | undefined, wanted: boolean) {
  const { run } = useAction();
  const [seed, setSeed] = useState<PostSeed | null | undefined>(wanted ? undefined : null);
  useEffect(() => {
    if (!wanted || !storeId) return;
    void run(() => api.post<PostDraft>("/api/v1/storefront/ai/post", { storeId })).then((res) => setSeed(res?.data ?? null));
  }, [wanted, storeId, run]);
  return seed;
}

export default function NewStorePost() {
  const { storeId, ai } = useLocalSearchParams<{ storeId?: string; ai?: string }>();
  const seed = useAiSeed(storeId, ai === "1");
  if (!storeId) return <EmptyState icon="storefront-outline" title="Pick a store first" message="Open Shop posts and choose the store to post for." />;
  if (seed === undefined) return <ManageStackScreen title="Writing a draft…" loading>{null}</ManageStackScreen>;
  return <PostForm storeId={storeId} seed={seed ?? undefined} />;
}
