import { forwardRef, useCallback, useMemo } from "react";
import { FlatList, StyleSheet, type FlatListProps } from "react-native";
import { FeaturedProductCard, GRID_CARD_WIDTH, GRID_GAP, GRID_H_PADDING } from "./FeaturedProductCard";
import { useProductActions } from "../lib/product-actions";
import { groupByProduct, effectivePrice, variantSummary } from "../lib/group-variants";
import type { StoreProduct } from "../lib/types";

type PassThroughProps = Omit<FlatListProps<StoreProduct>, "data" | "renderItem" | "horizontal" | "numColumns" | "keyExtractor">;

interface ProductListProps extends PassThroughProps {
  /** Raw store products from the API (one row per size); grouped into one card per product here */
  products: StoreProduct[];
  /** "grid": 2-column vertical list. "rail": horizontal row of cards. */
  layout: "grid" | "rail";
  /** Grid card width override (e.g. when the grid sits beside a sidebar) */
  cardWidth?: number;
  sortBy?: "price_asc" | "price_desc";
}

/**
 * The one way products are listed in the app. Must be rendered inside a ProductActionsProvider,
 * which supplies cart/wishlist actions and the size picker.
 */
export const ProductList = forwardRef<FlatList<StoreProduct>, ProductListProps>(function ProductList(
  { products, layout, cardWidth, sortBy, contentContainerStyle, ...listProps },
  ref,
) {
  const actions = useProductActions();

  const { primary, variantsByProductId } = useMemo(() => {
    const grouped = groupByProduct(products);
    if (sortBy) {
      const dir = sortBy === "price_asc" ? 1 : -1;
      grouped.primary.sort((a, b) => dir * (effectivePrice(a) - effectivePrice(b)));
    }
    return grouped;
  }, [products, sortBy]);

  const renderItem = useCallback(({ item }: { item: StoreProduct }) => {
    const variants = variantsByProductId.get(item.product.id) ?? [item];
    const { sizes, totalQty } = variantSummary(variants, actions.cartQuantityMap);
    return (
      <FeaturedProductCard
        item={item}
        width={layout === "grid" ? cardWidth ?? GRID_CARD_WIDTH : undefined}
        storeId={actions.storeId}
        quantity={totalQty}
        variantCount={variants.length}
        variantSizes={sizes}
        onShowVariants={() => actions.showVariants(variants)}
        onAddToCart={actions.addToCart}
        onUpdateQuantity={actions.updateQuantity}
        isWishlisted={actions.isWishlisted(item.product.id)}
        onToggleWishlist={actions.toggleWishlist}
        isMember={actions.isMember}
      />
    );
  }, [variantsByProductId, actions, layout, cardWidth]);

  const isGrid = layout === "grid";
  return (
    <FlatList
      ref={ref}
      data={primary}
      keyExtractor={(item) => item.product.id}
      renderItem={renderItem}
      extraData={actions}
      horizontal={!isGrid}
      numColumns={isGrid ? 2 : undefined}
      columnWrapperStyle={isGrid ? styles.gridRow : undefined}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[isGrid ? styles.gridContent : styles.railContent, contentContainerStyle]}
      {...listProps}
    />
  );
});

const styles = StyleSheet.create({
  gridRow: { gap: GRID_GAP },
  gridContent: { paddingHorizontal: GRID_H_PADDING },
  railContent: { paddingHorizontal: 16, paddingVertical: 4 },
});
