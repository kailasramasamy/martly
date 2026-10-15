import { useState } from "react";
import { useRouter } from "expo-router";
import { ManageStackScreen } from "../ManageStackScreen";
import { useStoreScope } from "../StoreScope";
import { EmptyState } from "../ui/EmptyState";
import { ProductPicker } from "../inventory/ProductPicker";
import { ListInStoreForm } from "../inventory/ListInStoreForm";
import { storeListing } from "../inventory/store-listing";
import type { CatalogProduct } from "../inventory/types";
import { NotInCatalog } from "./NotInCatalog";
import { useAddPermissions } from "./use-add-permissions";

function withName(path: string, query: string) {
  const name = query.trim();
  return name ? `${path}?name=${encodeURIComponent(name)}` : path;
}

/** Search the catalog and list a product in the store; falls back to creating it when it isn't there */
export function CatalogAddScreen() {
  const router = useRouter();
  const { storeId, picker } = useStoreScope({ required: true, placeholder: "Choose a store" });
  const [query, setQuery] = useState("");
  const [product, setProduct] = useState<CatalogProduct | null>(null);
  const { canList, canSnap, canManual } = useAddPermissions();

  if (!canList) {
    return <EmptyState icon="lock-closed-outline" title="No access" message="Your role can't add products to a store." />;
  }

  const pick = (p: CatalogProduct) => {
    const listing = storeId ? storeListing(p, storeId) : null;
    if (listing?.state === "full" && listing.firstListingId) router.push(`/manage/store-products/${listing.firstListingId}`);
    else setProduct(p);
  };

  const listedVariantIds = product && storeId ? storeListing(product, storeId).listedVariantIds : [];
  const searched = query.trim().length >= 2;

  return (
    <ManageStackScreen title="Add from catalog">
      {picker}
      {product ? (
        <ListInStoreForm
          key={product.id}
          product={product}
          storeId={storeId}
          listedVariantIds={listedVariantIds}
          onChangeProduct={() => setProduct(null)}
          onListed={router.back}
        />
      ) : (
        <>
          <ProductPicker storeId={storeId} onPick={pick} onQueryChange={setQuery} />
          {searched && (
            <NotInCatalog
              onSnap={canSnap ? () => router.push(withName("/manage/catalog-drafts/new", query)) : undefined}
              onManual={canManual ? () => router.push(withName("/manage/products/new", query)) : undefined}
            />
          )}
        </>
      )}
    </ManageStackScreen>
  );
}
