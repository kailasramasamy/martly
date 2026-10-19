import { useCallback, useMemo } from "react";
import { CompactProductCard } from "../../CompactProductCard";
import { cartQuantity, groupByProduct } from "../../../lib/group-variants";
import { useProductActions } from "../../../lib/product-actions";
import type { StoreProduct } from "../../../lib/types";

/** Home's compact product cards: one per product (its cheapest size), wired to the cart like every product list */
export function useCompactCards(products: StoreProduct[]) {
  const actions = useProductActions();
  const { primary, variantsByProductId } = useMemo(() => groupByProduct(products), [products]);

  const renderCard = useCallback((item: StoreProduct) => {
    const variants = variantsByProductId.get(item.product.id) ?? [item];
    return (
      <CompactProductCard
        item={item}
        storeId={actions.storeId}
        quantity={cartQuantity(variants, actions.cartQuantityMap)}
        variants={variants}
        quantityOf={(id) => actions.cartQuantityMap.get(id) ?? 0}
        onShowVariants={() => actions.showVariants(variants)}
        onAddToCart={actions.addToCart}
        onUpdateQuantity={actions.updateQuantity}
        isWishlisted={actions.isWishlisted(item.product.id)}
        onToggleWishlist={actions.toggleWishlist}
        isMember={actions.isMember}
      />
    );
  }, [variantsByProductId, actions]);

  return { products: primary, renderCard };
}
