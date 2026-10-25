import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { colors, fonts } from "../../../constants/theme";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { formatDate, formatTime } from "../../../lib/i18n/format";
import type { StorePost } from "../../../lib/types";
import { KindTag } from "../../store-voice/voice";
import { ManageStackScreen } from "../ManageStackScreen";
import { HeaderAction } from "../HeaderAction";
import { useStoreScope } from "../StoreScope";
import { Button } from "../ui/Button";
import { ConfirmDialog } from "../ui/ConfirmDialog";
import { EmptyState } from "../ui/EmptyState";
import { SectionCard } from "../ui/SectionCard";
import { StatusPill } from "../ui/StatusPill";

const when = (iso: string) => `${formatDate(iso, { day: "numeric", month: "short" })}, ${formatTime(iso)}`;

function PostCard({ post, onEdit, onDelete }: { post: StorePost; onEdit: () => void; onDelete: () => void }) {
  const live = new Date(post.expiresAt) > new Date();
  return (
    <SectionCard>
      <TouchableOpacity onPress={onEdit} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Edit post">
      <View style={styles.head}>
        <KindTag kind={post.kind} />
        <StatusPill label={live ? `Live till ${when(post.expiresAt)}` : "Ended"} color={live ? "#166534" : "#64748b"} bg={live ? "#dcfce7" : "#f1f5f9"} dot={live} />
      </View>
      <Text style={styles.text}>{post.text}</Text>
      {post.translations && Object.values(post.translations).map((tr) => tr && <Text key={tr.text} style={styles.translation}>{tr.text}</Text>)}
      <Text style={styles.meta}>{`${when(post.createdAt)} · ${post.products.length} products in stock`}</Text>
      </TouchableOpacity>
      <View style={styles.buttons}>
        <Button label="Edit" icon="create-outline" variant="secondary" compact onPress={onEdit} style={styles.button} />
        <Button label="Delete" icon="trash-outline" variant="danger" compact onPress={onDelete} style={styles.button} />
      </View>
    </SectionCard>
  );
}

/** The owner's posts at a store: live ones first, ended ones from the last month; + writes a new one */
export function PostsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Pick a store" });
  const { run, running } = useAction();
  const { data, loading, error, reload } = useResource<StorePost[]>(storeId ? `/api/v1/store-voice/posts?storeId=${storeId}` : null);
  const [deleting, setDeleting] = useState<StorePost | null>(null);
  if (!can(user, "store-posts", "list")) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't post to shoppers." />;

  const remove = async () => {
    if (!deleting) return;
    const ok = await run(() => api.delete(`/api/v1/store-voice/posts/${deleting.id}`), "Post deleted");
    setDeleting(null);
    if (ok) void reload();
  };
  const headerRight = storeId ? () => <HeaderAction onPress={() => router.push({ pathname: "/manage/store-posts/new", params: { storeId } })} accessibilityLabel="New post" /> : undefined;
  return (
    <ManageStackScreen title="Shop posts" headerRight={headerRight} loading={loading} error={error} onRetry={reload} onRefresh={reload}>
      {picker}
      {storeId && data?.length === 0 && (
        <EmptyState icon="megaphone-outline" title="No posts yet" message="Tell shoppers what came in today. Use + to write or speak a post." />
      )}
      {data?.map((post) => (
        <PostCard key={post.id} post={post} onEdit={() => router.push(`/manage/store-posts/${post.id}`)} onDelete={() => setDeleting(post)} />
      ))}
      <ConfirmDialog
        visible={deleting !== null} title="Delete this post?" message="Shoppers stop seeing it on Home and the shop's board."
        confirmLabel="Delete" running={running} onConfirm={remove} onClose={() => setDeleting(null)}
      />
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 },
  text: { fontFamily: fonts.semibold, fontSize: 14.5, lineHeight: 21, color: colors.text },
  translation: { marginTop: 6, fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  buttons: { flexDirection: "row", gap: 10 },
  button: { flex: 1 },
  meta: { marginTop: 8, marginBottom: 10, fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
});
