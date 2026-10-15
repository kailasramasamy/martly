import { View, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { useRefreshOnFocus } from "../../../lib/manage/use-refresh-on-focus";
import { ManageStackScreen } from "../../../components/manage/ManageStackScreen";
import { HeaderAction } from "../../../components/manage/HeaderAction";
import { ProductDetailView } from "../../../components/manage/products/ProductDetailView";
import { canEditProduct } from "../../../components/manage/products/access";
import type { ProductDetail } from "../../../components/manage/products/types";

/** Always opens read-only; editors get an Edit action rather than landing straight in the form */
export default function ProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { data, loading, error, reload } = useResource<ProductDetail>(`/api/v1/products/${id}`);
  useRefreshOnFocus(reload);
  const editable = !!data && canEditProduct(user, data);

  const headerRight = () => (
    <View style={styles.actions}>
      <HeaderAction icon="storefront-outline" accessibilityLabel="Stores" onPress={() => router.push(`/manage/products/${id}/stores`)} />
      {editable && <HeaderAction icon="create-outline" label="Edit" onPress={() => router.push(`/manage/products/${id}/edit`)} />}
    </View>
  );

  return (
    <ManageStackScreen title={data?.name ?? "Product"} loading={loading} error={error} onRetry={reload} headerRight={headerRight}>
      {data && <ProductDetailView product={data} />}
    </ManageStackScreen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", alignItems: "center", gap: 4 },
});
