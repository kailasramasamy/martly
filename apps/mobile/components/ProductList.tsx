import { forwardRef, useCallback, useMemo, type ReactElement } from "react";
import { FlatList, StyleSheet, View, type FlatListProps } from "react-native";
import { FeaturedProductCard, GRID_CARD_WIDTH, GRID_GAP, GRID_H_PADDING } from "./FeaturedProductCard";
import { COMPACT_CARD_WIDTH, COMPACT_GAP } from "./CompactProductCard";
import { ProductGridRow } from "./ProductGridRow";
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
  /** Grid columns; 3 renders the compact card (search results) */
  numColumns?: 2 | 3;
  /** Full-width element rendered between grid rows; `bleed` is the list's horizontal padding it cancels */
  midSlot?: { afterRows: number; element: ReactElement | null; bleed?: number };
}

type GridRowItem = { key: string; products?: StoreProduct[] };

const SLOT_KEY = "__mid_slot__";

function buildGridRows(products: StoreProduct[], columns: number, afterRows: number): GridRowItem[] {
  const rows: GridRowItem[] = [];
  for (let i = 0; i < products.length; i += columns) {
    const chunk = products.slice(i, i + columns);
    rows.push({ key: chunk[0].product.id, products: chunk });
  }
  rows.splice(Math.min(afterRows, rows.length), 0, { key: SLOT_KEY });
  return rows;
}

/**
 * The one way products are listed in the app. Must be rendered inside a ProductActionsProvider,
 * which supplies cart/wishlist actions and the size picker.
 */
export const ProductList = forwardRef<FlatList<StoreProduct>, ProductListProps>(function ProductList(
  { products, layout, cardWidth, sortBy, numColumns = 2, midSlot, contentContainerStyle, ...listProps },
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

  const renderCard = useCallback((item: StoreProduct) => {
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
        compact={layout === "grid" && numColumns === 3}
        onShowVariants={() => actions.showVariants(variants)}
        onAddToCart={actions.addToCart}
        onUpdateQuantity={actions.updateQuantity}
        isWishlisted={actions.isWishlisted(item.product.id)}
        onToggleWishlist={actions.toggleWishlist}
        isMember={actions.isMember}
      />
    );
  }, [variantsByProductId, actions, layout, cardWidth, numColumns]);

  const renderItem = useCallback(({ item }: { item: StoreProduct }) => renderCard(item), [renderCard]);

  const isGrid = layout === "grid";
  const slotElement = isGrid ? midSlot?.element ?? null : null;
  const gridRows = useMemo(
    () => (slotElement && midSlot ? buildGridRows(primary, numColumns, midSlot.afterRows) : []),
    [slotElement, midSlot, primary, numColumns],
  );

  const renderRow = useCallback(({ item }: { item: GridRowItem }) => {
    if (!item.products) {
      const bleed = -(midSlot?.bleed ?? GRID_H_PADDING);
      return <View style={{ marginHorizontal: bleed }}>{slotElement}</View>;
    }
    return (
      <ProductGridRow
        items={item.products}
        columns={numColumns}
        gap={numColumns === 3 ? COMPACT_GAP : GRID_GAP}
        cardWidth={numColumns === 3 ? COMPACT_CARD_WIDTH : cardWidth ?? GRID_CARD_WIDTH}
        renderCard={renderCard}
      />
    );
  }, [midSlot?.bleed, slotElement, numColumns, cardWidth, renderCard]);

  if (slotElement) {
    return (
      <FlatList
        ref={ref as React.Ref<FlatList<GridRowItem>>}
        data={gridRows}
        keyExtractor={(row) => row.key}
        renderItem={renderRow}
        extraData={actions}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.gridContent, contentContainerStyle]}
        {...(listProps as Omit<FlatListProps<GridRowItem>, "data" | "renderItem">)}
      />
    );
  }

  return (
    <FlatList
      ref={ref}
      data={primary}
      keyExtractor={(item) => item.product.id}
      renderItem={renderItem}
      extraData={actions}
      horizontal={!isGrid}
      numColumns={isGrid ? numColumns : undefined}
      columnWrapperStyle={isGrid ? (numColumns === 3 ? styles.compactRow : styles.gridRow) : undefined}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={[isGrid ? styles.gridContent : styles.railContent, contentContainerStyle]}
      {...listProps}
    />
  );
});

const styles = StyleSheet.create({
  gridRow: { gap: GRID_GAP },
  compactRow: { gap: COMPACT_GAP },
  gridContent: { paddingHorizontal: GRID_H_PADDING },
  railContent: { paddingHorizontal: 16, paddingVertical: 4 },
});
