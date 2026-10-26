import type { ReactElement, ReactNode } from "react";
import { View, Animated, FlatList, KeyboardAvoidingView, Platform, RefreshControl, StyleSheet, useWindowDimensions } from "react-native";
import { Loader } from "../Loader";
import { Stack } from "expo-router";
import type { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useKeyboardReveal } from "../../lib/use-keyboard-reveal";
import { manage } from "./ui/tokens";
import { SearchField } from "./ui/SearchField";
import { ListSkeleton } from "./ui/ListSkeleton";
import { GridSkeleton } from "./ui/GridSkeleton";
import { EmptyState } from "./ui/EmptyState";
import { useCollapsingToolbar } from "./use-collapsing-toolbar";

interface ListSource<T> {
  items: T[];
  loading: boolean;
  refreshing: boolean;
  loadingMore: boolean;
  error: string | null;
  refresh: () => void;
  loadMore: () => void;
}

interface ManageListScreenProps<T> {
  title: string;
  list: ListSource<T>;
  /** `cell.width` is the column width when `columns` is set */
  renderItem: (item: T, cell: { width: number }) => ReactElement;
  keyExtractor?: (item: T) => string;
  search?: { value: string; onChange: (q: string) => void; placeholder?: string };
  /** Filters under the search box, e.g. <SegmentedTabs/> */
  filters?: ReactNode;
  headerRight?: () => ReactNode;
  empty: { icon: keyof typeof Ionicons.glyphMap; title: string; message?: string };
  /** Pinned under the list, e.g. a bulk-action bar */
  footer?: ReactNode;
  /** Lay items out as a grid of this many columns, e.g. photo tiles */
  columns?: number;
  /** Slide the search and filters away while scrolling down the list; they return on scroll up */
  collapseToolbar?: boolean;
}

// Animated.FlatList loses the item generic; this keeps renderItem typed
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList) as unknown as typeof FlatList;

const GRID_PAD = 12;
const GRID_GAP = 8;

/** Stack-level list screen: native header, search + filters, paged FlatList, skeleton, empty and error states */
export function ManageListScreen<T extends { id: string }>(props: ManageListScreenProps<T>) {
  const { title, list, renderItem, search, filters, headerRight, empty, footer, columns } = props;
  const { width: screenWidth } = useWindowDimensions();
  const cellWidth = columns ? Math.floor((screenWidth - GRID_PAD * 2 - GRID_GAP * (columns - 1)) / columns) : screenWidth;
  const keyExtractor = props.keyExtractor ?? ((item: T) => item.id);
  const showToolbar = !!search || !!filters;
  const collapse = !!props.collapseToolbar && showToolbar;
  const toolbar = useCollapsingToolbar(collapse);
  // A collapsing toolbar floats over the list, so the list starts below it
  const inset = collapse ? { paddingTop: toolbar.height } : undefined;
  // A footer with inputs (a bulk-action bar) rides up with the keyboard, and a field typed into in the list scrolls into
  // view above it; a collapsing toolbar owns the scroll position, so that list isn't scrolled for the keyboard
  const keyboard = useKeyboardReveal<FlatList>();

  return (
    <View ref={keyboard.rootRef} style={styles.root} onLayout={keyboard.onRootLayout}>
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={keyboard.topOffset}>
      <Stack.Screen options={{ title, headerRight }} />
      {showToolbar && (
        <Animated.View
          style={[styles.toolbar, collapse && styles.floating, { transform: [{ translateY: toolbar.translateY }] }]}
          onLayout={collapse ? toolbar.onLayout : undefined}
        >
          {search && <SearchField value={search.value} onChange={search.onChange} placeholder={search.placeholder} />}
          {filters}
        </Animated.View>
      )}
      {list.loading ? <View style={inset}>{columns ? <GridSkeleton columns={columns} width={cellWidth} gap={GRID_GAP} padding={GRID_PAD} /> : <ListSkeleton />}</View> : (
        <AnimatedFlatList
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          key={columns ?? 1}
          data={list.items}
          keyExtractor={keyExtractor}
          renderItem={({ item }) => renderItem(item, { width: cellWidth })}
          numColumns={columns}
          columnWrapperStyle={columns ? styles.gridRow : undefined}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          ref={collapse ? undefined : keyboard.scrollRef}
          onScroll={collapse ? toolbar.onScroll : keyboard.onScroll}
          scrollEventThrottle={16}
          refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.primary} progressViewOffset={toolbar.height} />}
          ListEmptyComponent={<ListEmpty error={list.error} empty={empty} onRetry={list.refresh} />}
          ListFooterComponent={list.loadingMore ? <Loader style={styles.more} /> : null}
          contentContainerStyle={[list.items.length === 0 ? styles.emptyContent : columns ? styles.grid : undefined, inset]}
        />
      )}
      {footer}
    </KeyboardAvoidingView>
    </View>
  );
}

function ListEmpty({ error, empty, onRetry }: { error: string | null; empty: ManageListScreenProps<unknown>["empty"]; onRetry: () => void }) {
  return error
    ? <EmptyState icon="cloud-offline-outline" title="Couldn't load" message={error} action={{ label: "Try again", onPress: onRetry }} />
    : <EmptyState icon={empty.icon} title={empty.title} message={empty.message} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: manage.canvas },
  toolbar: { padding: 12, gap: 10, backgroundColor: manage.canvas, borderBottomWidth: 1, borderBottomColor: manage.line },
  floating: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 1 },
  more: { paddingVertical: 20 },
  emptyContent: { flexGrow: 1 },
  grid: { padding: GRID_PAD, gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
});
