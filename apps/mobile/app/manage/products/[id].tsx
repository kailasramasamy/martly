import { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { useResource } from "../../../lib/manage/use-resource";
import { fonts, radius } from "../../../constants/theme";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { Button } from "../../../components/manage/ui/Button";
import { manage } from "../../../components/manage/ui/tokens";
import { ProductDetailView } from "../../../components/manage/products/ProductDetailView";
import { canEditProduct } from "../../../components/manage/products/access";
import { OwnerPickSection } from "../../../components/manage/store-voice/OwnerPickSection";
import type { ProductDetail } from "../../../components/manage/products/types";

const TAMIL_POLL_MS = 3000;
const TAMIL_POLL_TRIES = 10;

/** A new product's Tamil lands a few seconds after it's saved: check back until it does */
function useTamilArrival(product: ProductDetail | null, reload: () => Promise<void>) {
  const waiting = !!product?.isDraft && !product.translations?.ta?.name;
  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const timer = setInterval(() => {
      tries += 1;
      if (tries > TAMIL_POLL_TRIES) clearInterval(timer);
      else void reload();
    }, TAMIL_POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, reload]);
}

/** Always opens read-only; editors get an Edit action rather than landing straight in the form */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<ProductDetail>(`/api/v1/products/${id}`);
  const { run, running } = useAction();
  const editable = !!data && canEditProduct(user, data);
  const canLaunch = editable && !!data?.isDraft;
  useTamilArrival(data, reload);

  const launch = async () => {
    const done = await run(() => api.post(`/api/v1/products/${id}/launch`, {}), "Product is live");
    if (done) void reload();
  };

  const headerRight = () => (
    <View style={styles.actions}>
      <HeaderAction icon="storefront-outline" accessibilityLabel="Stores" onPress={() => router.push(`/manage/products/${id}/stores`)} />
      {editable && <HeaderAction icon="create-outline" label="Edit" onPress={() => router.push(`/manage/products/${id}/edit`)} />}
    </View>
  );

  return (
    <ManageStackScreen
      title={data?.name ?? "Product"}
      loading={loading}
      error={error}
      onRetry={reload}
      headerRight={headerRight}
      actions={canLaunch ? <Button label="Launch product" icon="rocket-outline" onPress={launch} loading={running} style={{ flex: 1 }} /> : undefined}
    >
      {data?.isDraft ? (
        <View style={styles.draft}>
          <Text style={styles.draftText}>Draft. Shoppers can't see it yet. Check the details and the Tamil, then launch it.</Text>
        </View>
      ) : null}
      {data && <ProductDetailView product={data} />}
      {data && !data.isDraft && <OwnerPickSection productId={data.id} />}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
  draft: { backgroundColor: manage.attentionBg, borderRadius: radius.lg, padding: 12 },
  draftText: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, color: manage.attentionText },
});
