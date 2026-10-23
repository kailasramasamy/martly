import { useRef } from "react";
import { View, FlatList, StyleSheet } from "react-native";
import type { Store } from "../../lib/types";
import { StoreDetailPanel, type StoreBanner } from "./StoreDetailPanel";
import { StoreTile, TILE_WIDTH } from "./StoreTile";

const GAP = 10;

interface StoreBrowserProps {
  stores: Store[];
  activeId: string | null;
  onPreview: (store: Store) => void;
  isMuted: (store: Store) => boolean;
  /** Page gutter, so the strip can run to the screen edges */
  inset: number;
  onBannerPress: (store: Store, banner: StoreBanner) => void;
}

/** Stores side by side in a strip; the one being previewed is shown in full below */
export function StoreBrowser({ stores, activeId, onPreview, isMuted, inset, onBannerPress }: StoreBrowserProps) {
  const active = stores.find((s) => s.id === activeId) ?? stores[0];
  const startAt = Math.max(0, stores.findIndex((s) => s.id === active?.id));
  const listRef = useRef<FlatList<Store>>(null);
  // A tile tapped at the edge of the screen slides fully into view
  const preview = (store: Store) => {
    onPreview(store);
    listRef.current?.scrollToIndex({ index: stores.findIndex((s) => s.id === store.id), viewPosition: 0.5, animated: true });
  };
  return (
    <View style={styles.root}>
      <FlatList
        ref={listRef}
        horizontal
        data={stores}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => <StoreTile store={item} active={item.id === active?.id} muted={isMuted(item)} onPress={preview} />}
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -inset }}
        contentContainerStyle={{ paddingHorizontal: inset, gap: GAP }}
        getItemLayout={(_, index) => ({ length: TILE_WIDTH + GAP, offset: (TILE_WIDTH + GAP) * index, index })}
        initialScrollIndex={startAt > 1 ? startAt - 1 : 0}
      />
      {active && <StoreDetailPanel key={active.id} store={active} onBannerPress={onBannerPress} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
});
