import { FlatList, RefreshControl, StyleSheet, type FlatListProps } from "react-native";
import { Loader } from "../../Loader";
import { colors } from "../../../constants/theme";
import { EmptyState } from "../ui/EmptyState";
import { ListSkeleton } from "../ui/ListSkeleton";
import { OrderRow } from "./OrderRow";
import type { OrderListItem } from "./types";

interface OrdersListProps {
  list: {
    items: OrderListItem[];
    loading: boolean;
    refreshing: boolean;
    loadingMore: boolean;
    error: string | null;
    refresh: () => void;
    loadMore: () => void;
  };
  selected: Map<string, OrderListItem>;
  searching: boolean;
  onOpen: (order: OrderListItem) => void;
  onSelect: (order: OrderListItem) => void;
  onAdvance: (order: OrderListItem, status: string) => void;
  /** Tab-screen scroll handling (tab bar auto-hide, header collapse), owned by the screen */
  scrollProps: Pick<FlatListProps<OrderListItem>, "onScroll" | "scrollEventThrottle" | "onContentSizeChange" | "onLayout">;
  /** Bottom padding so the last rows clear the tab bar and any docked footer */
  contentContainerStyle?: FlatListProps<OrderListItem>["contentContainerStyle"];
}

export function OrdersList({ list, selected, searching, onOpen, onSelect, onAdvance, scrollProps, contentContainerStyle }: OrdersListProps) {
  if (list.loading) return <ListSkeleton />;
  return (
    <FlatList {...scrollProps}
      contentContainerStyle={contentContainerStyle}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
      data={list.items}
      keyExtractor={(o) => o.id}
      renderItem={({ item }) => (
        <OrderRow
          order={item}
          selected={selected.size > 0 ? selected.has(item.id) : undefined}
          onOpen={onOpen}
          onSelect={onSelect}
          onAdvance={onAdvance}
        />
      )}
      extraData={selected}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.4}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.primary} />}
      ListEmptyComponent={
        list.error
          ? <EmptyState icon="cloud-offline-outline" title="Couldn't load orders" message={list.error} action={{ label: "Try again", onPress: list.refresh }} />
          : <EmptyState icon="receipt-outline" title="No orders here" message={searching ? "Nothing matches that search." : "New orders will appear as they come in."} />
      }
      ListFooterComponent={list.loadingMore ? <Loader style={styles.more} /> : null}
    />
  );
}

const styles = StyleSheet.create({
  more: { paddingVertical: 20 },
});
