import { useMemo, useState } from "react";
import { useRouter } from "expo-router";
import { can } from "@martly/shared/permissions";
import { api } from "../../../lib/api";
import { useAuth } from "../../../lib/auth-context";
import { useAction } from "../../../lib/manage/use-action";
import { usePagedList } from "../../../lib/manage/use-paged-list";
import { useManageScope } from "../../../lib/manage-scope-context";
import { ManageListScreen } from "../ManageListScreen";
import { HeaderAction } from "../HeaderAction";
import { Button } from "../ui/Button";
import { ListRow } from "../ui/ListRow";
import { EmptyState } from "../ui/EmptyState";
import { FeaturePickerSheet } from "./FeaturePickerSheet";
import { describeListing, type FeaturedStoreProduct } from "./featured-types";

export function FeaturedProductsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { storeId } = useManageScope();
  const { run } = useAction();
  const [q, setQ] = useState("");
  const [picking, setPicking] = useState(false);
  const params = useMemo(() => ({ isFeatured: "true", storeId, q }), [storeId, q]);
  const list = usePagedList<FeaturedStoreProduct>("/api/v1/store-products", params);
  const canEdit = can(user, "featured-products", "edit");

  const unfeature = async (sp: FeaturedStoreProduct) => {
    const ok = await run(() => api.put(`/api/v1/store-products/${sp.id}`, { isFeatured: false }), "Removed from featured");
    if (ok) list.refresh();
  };

  if (!canEdit) return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't manage featured products." />;
  return (
    <>
      <ManageListScreen
        title="Featured products"
        list={list}
        search={{ value: q, onChange: setQ, placeholder: "Search featured products" }}
        headerRight={() => <HeaderAction onPress={() => setPicking(true)} accessibilityLabel="Add featured product" />}
        empty={{ icon: "sparkles-outline", title: "Nothing featured yet", message: "Use + to feature products shoppers should see first." }}
        renderItem={(sp) => (
          <ListRow
            title={sp.product.name}
            subtitle={describeListing(sp, !storeId)}
            caption={sp.product.brand?.name}
            imageUrl={sp.product.imageUrl}
            railColor={sp.isActive ? undefined : "#94a3b8"}
            trailing={<Button label="Unfeature" variant="danger" compact onPress={() => unfeature(sp)} />}
            onPress={() => router.push(`/manage/products/${sp.product.id}`)}
          />
        )}
      />
      <FeaturePickerSheet visible={picking} storeId={storeId} onClose={() => { setPicking(false); list.refresh(); }} />
    </>
  );
}
