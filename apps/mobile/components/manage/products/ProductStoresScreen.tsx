import { useLocalSearchParams } from "expo-router";
import { can } from "@martly/shared/permissions";
import { useAuth } from "../../../lib/auth-context";
import { useResource } from "../../../lib/manage/use-resource";
import { useManageScope } from "../../../lib/manage-scope-context";
import { ManageStackScreen } from "../ManageStackScreen";
import { MappingList } from "./MappingList";
import { MapProductCard } from "./MapProductCard";
import { useStoreMappings } from "./use-store-mappings";
import type { ProductDetail } from "./types";

export function ProductStoresScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { stores } = useManageScope();
  const product = useResource<ProductDetail>(`/api/v1/products/${id}`);
  const m = useStoreMappings(id);
  // Listing a product in a store (or removing it) is a store-listing permission, not a catalog one
  const canMap = can(user, "store-products", "create");
  const canUnmap = can(user, "store-products", "delete");
  const activeStores = stores.filter((s) => s.status === "ACTIVE");

  return (
    <ManageStackScreen
      title={product.data ? `${product.data.name} · stores` : "Stores"}
      loading={m.loading || product.loading}
      error={m.error ?? product.error}
      onRetry={() => { m.load(); product.reload(); }}
    >
      <MappingList mappings={m.mappings} canUnmap={canUnmap} busy={m.busy} onToggle={m.toggle} onUnmap={m.unmap} />
      {canMap && product.data && activeStores.length > 0 && (
        <MapProductCard variants={product.data.variants} stores={activeStores} onMapped={m.load} />
      )}
    </ManageStackScreen>
  );
}
