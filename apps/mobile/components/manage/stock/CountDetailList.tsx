import type { RefObject } from "react";
import { FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";
import { EmptyState } from "../ui/EmptyState";
import { CountItemRow } from "./CountItemRow";
import { CountReviewRow } from "./CountReviewRow";
import { CountSummary } from "./CountSummary";
import { RecountBanner } from "./RecountBanner";
import { selectable, type useCountReview } from "./use-count-review";
import type { useCountDetail } from "./use-count-detail";
import type { StockCountDetail } from "./types";

interface CountDetailListProps {
  count: StockCountDetail;
  c: ReturnType<typeof useCountDetail>;
  review: ReturnType<typeof useCountReview>;
  /** Blind entry rows instead of read-only review rows */
  editing: boolean;
  /** From useKeyboardReveal, so a focused count field scrolls above the keyboard and sticky bar */
  listRef: RefObject<FlatList | null>;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

/** Banner and summary on top, then one row per line: entry while editing, review otherwise */
export function CountDetailList({ count, c, review, editing, listRef, onScroll }: CountDetailListProps) {
  const recounting = count.status === "RECOUNT";
  return (
    <FlatList
      ref={listRef}
      onScroll={onScroll}
      scrollEventThrottle={16}
      data={count.items}
      extraData={review.selected}
      keyExtractor={(i) => i.storeProductId}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      ListHeaderComponent={<>
        {recounting && <RecountBanner items={count.recountItems} note={count.reviewNote} forCounter={editing} />}
        <CountSummary count={count} />
      </>}
      ListEmptyComponent={<EmptyState icon="cube-outline" title="No products" message="This aisle has no products listed in the store." />}
      renderItem={({ item }) => editing
        ? <CountItemRow item={item} value={c.valueFor(item.storeProductId, item.countedQty)} onChange={c.setQty} />
        : <CountReviewRow item={item} recounting={recounting} onPress={count.canSeeSystemStock ? review.onRowPress : undefined}
            selected={review.selected && selectable(item) ? review.selected.has(item.storeProductId) : undefined} />}
    />
  );
}
