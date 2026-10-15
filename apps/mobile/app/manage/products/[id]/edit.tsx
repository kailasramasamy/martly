import { useLocalSearchParams } from "expo-router";
import { useResource } from "../../../../lib/manage/use-resource";
import { ManageStackScreen } from "../../../../components/manage/ManageStackScreen";
import { ProductForm } from "../../../../components/manage/products/ProductForm";
import type { ProductDetail } from "../../../../components/manage/products/types";

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, loading, error, reload } = useResource<ProductDetail>(`/api/v1/products/${id}`);

  if (data) return <ProductForm product={data} />;
  return <ManageStackScreen title="Edit product" loading={loading} error={error} onRetry={reload}>{null}</ManageStackScreen>;
}
