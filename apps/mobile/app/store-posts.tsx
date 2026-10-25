import { useCallback, useEffect, useState } from "react";
import { FlatList, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { router } from "expo-router";
import { colors, fonts } from "../constants/theme";
import { api, ApiError } from "../lib/api";
import { useLanguage } from "../lib/language-context";
import { getBestPrice } from "../lib/membership-context";
import { ProductActionsProvider, useProductActions } from "../lib/product-actions";
import { useStore } from "../lib/store-context";
import { useStrings } from "../lib/i18n/use-strings";
import type { StoreProduct, StorePost } from "../lib/types";
import { Loader } from "../components/Loader";
import { AddButton } from "../components/store-voice/AddButton";
import { KindTag, OwnerAvatar, usePostTime, useVoiceText } from "../components/store-voice/voice";

type Posts = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; posts: StorePost[] };

function usePosts(storeId: string | undefined) {
  const [state, setState] = useState<Posts>({ kind: "loading" });
  const load = useCallback(async () => {
    if (!storeId) return setState({ kind: "ready", posts: [] });
    setState({ kind: "loading" });
    try {
      const res = await api.get<StorePost[]>(`/api/v1/store-voice/posts/live?storeId=${storeId}`);
      setState({ kind: "ready", posts: res.data });
    } catch (err) {
      if (!(err instanceof ApiError || err instanceof TypeError)) throw err;
      setState({ kind: "failed" });
    }
  }, [storeId]);
  useEffect(() => { void load(); }, [load]);
  return { state, load };
}

function ProductLine({ sp }: { sp: StoreProduct }) {
  const { getLocalizedName } = useLanguage();
  const { isMember, storeId } = useProductActions();
  const image = sp.product.imageUrl ?? sp.variant.imageUrl;
  return (
    <View style={styles.line}>
      <TouchableOpacity
        style={styles.lineOpen} accessibilityRole="button"
        onPress={() => router.push({ pathname: "/product/[id]", params: storeId ? { id: sp.product.id, storeId } : { id: sp.product.id } })}
      >
        <View style={styles.thumb}>{image && <Image source={{ uri: image }} style={styles.thumbImg} />}</View>
        <View style={styles.lineInfo}>
          <Text style={styles.lineName} numberOfLines={2}>{getLocalizedName(sp.product)}</Text>
          <Text style={styles.lineSize}>{sp.variant.name}</Text>
        </View>
      </TouchableOpacity>
      <Text style={styles.price}>{`₹${Math.round(getBestPrice(sp, isMember))}`}</Text>
      <AddButton sp={sp} wide />
    </View>
  );
}

function PostCard({ post }: { post: StorePost }) {
  const voice = useVoiceText();
  const when = usePostTime();
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <KindTag kind={post.kind} />
        <Text style={styles.when}>{when(post.createdAt)}</Text>
      </View>
      <Text style={styles.text}>{voice(post)}</Text>
      {post.products.map((sp) => <ProductLine key={sp.id} sp={sp} />)}
    </View>
  );
}

function Owner({ post, store }: { post: StorePost | undefined; store: { name: string; logoUrl?: string | null } }) {
  const t = useStrings("storeVoice");
  const name = post?.author ?? store.name;
  return (
    <View style={styles.owner}>
      <OwnerAvatar name={name} logoUrl={store.logoUrl} size={52} />
      <View style={styles.ownerText}>
        <Text style={styles.ownerName}>{post ? t.ownerOf(post.author, store.name) : store.name}</Text>
        <Text style={styles.ownerSub}>{t.boardSubtitle}</Text>
      </View>
    </View>
  );
}

/** The shop's board: the owner's live posts this week, newest first, each with its products to add */
export default function StorePostsScreen() {
  const t = useStrings("storeVoice");
  const { selectedStore } = useStore();
  const { getLocalizedName } = useLanguage();
  const { state, load } = usePosts(selectedStore?.id);
  if (state.kind === "loading" || !selectedStore) return <View style={[styles.page, styles.center]}><Loader /></View>;
  const store = { name: getLocalizedName(selectedStore), logoUrl: selectedStore.logoUrl };
  return (
    <ProductActionsProvider store={selectedStore}>
      <FlatList
        style={styles.page}
        contentContainerStyle={styles.content}
        data={state.kind === "ready" ? state.posts : []}
        keyExtractor={(p) => p.id}
        ListHeaderComponent={<Owner post={state.kind === "ready" ? state.posts[0] : undefined} store={store} />}
        ListEmptyComponent={(
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{state.kind === "failed" ? t.loadFailed : t.noPosts}</Text>
            {state.kind === "failed" && (
              <TouchableOpacity style={styles.retry} onPress={load} accessibilityRole="button"><Text style={styles.retryText}>{t.retry}</Text></TouchableOpacity>
            )}
          </View>
        )}
        renderItem={({ item }) => <PostCard post={item} />}
      />
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.surface },
  center: { alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 14, paddingBottom: 32 },
  owner: { flexDirection: "row", alignItems: "center", gap: 12 },
  ownerText: { flex: 1, gap: 2 },
  ownerName: { fontFamily: fonts.extrabold, fontSize: 17, color: colors.text },
  ownerSub: { fontFamily: fonts.semibold, fontSize: 13, color: "#475569" },
  card: { borderRadius: 16, backgroundColor: "#ffffff", borderWidth: 1, borderColor: colors.border, padding: 14, gap: 10 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  when: { fontFamily: fonts.bold, fontSize: 12, color: colors.textSecondary },
  text: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20, color: "#1e293b" },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
  lineOpen: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  thumbImg: { width: 38, height: 38, resizeMode: "contain" },
  lineInfo: { flex: 1, minWidth: 0 },
  lineName: { fontFamily: fonts.bold, fontSize: 13, color: colors.text },
  lineSize: { fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary },
  price: { fontFamily: fonts.extrabold, fontSize: 14, color: colors.text },
  empty: { alignItems: "center", paddingTop: 48, gap: 16 },
  emptyText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
  retry: { height: 44, paddingHorizontal: 20, borderRadius: 10, borderWidth: 1.5, borderColor: colors.primary, justifyContent: "center" },
  retryText: { fontFamily: fonts.bold, fontSize: 14, color: colors.primary },
});
