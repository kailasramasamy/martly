import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Loader } from "../../components/Loader";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { useStore } from "../../lib/store-context";
import { ProductActionsProvider } from "../../lib/product-actions";
import { useCollectionProducts } from "../../lib/use-collection-products";
import { ProductList } from "../../components/ProductList";
import { FloatingCart } from "../../components/FloatingCart";
import { CollectionBanner } from "../../components/collection/CollectionBanner";
import { CampaignHeader, campaignHeaderColor } from "../../components/collection/CampaignHeader";
import { AisleChips } from "../../components/collection/AisleChips";
import { CollectionSearchField } from "../../components/collection/CollectionSearchField";
import { useLightStatusBar } from "../../lib/use-light-status-bar";

function Message({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.message}>
      <Ionicons name={icon} size={28} color={colors.textSecondary} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

type Collection = NonNullable<ReturnType<typeof useCollectionProducts>["collection"]>;

function BarTitle({ title, subtitle }: { title: string; subtitle: string | null }) {
  return (
    <View style={styles.barTitle} accessibilityRole="header">
      <Text style={styles.barTitleText} numberOfLines={1}>{title}</Text>
      {subtitle ? <Text style={styles.barSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
    </View>
  );
}

/** A campaign's screen wears its colours from the navigation bar down, matching its Home card, and its headline block
 *  names it under a bare back arrow; any other collection is named in the bar itself, so the list starts right under it */
// The bar wraps it in its own glass button and starts a small view at that button's leading edge, so the icon is
// centred in a box as wide as the button's content (as tall would stretch the button into an oval)
function SearchButton({ ink, onPress }: { ink: string; onPress: () => void }) {
  const t = useStrings("home");
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.searchButton} accessibilityRole="button" accessibilityLabel={t.searchInCollection}>
      <Ionicons name="search" size={22} color={ink} style={styles.searchIcon} />
    </Pressable>
  );
}

function useCollectionBar(collection: Collection | null, onSearch: () => void) {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const theme = collection?.campaign?.theme ?? null;
  useLightStatusBar(Boolean(theme?.dark));
  useEffect(() => {
    if (!collection) return;
    navigation.setOptions({
      title: "",
      headerBackButtonDisplayMode: "minimal",
      headerRight: () => <SearchButton ink={theme?.title ?? colors.text} onPress={onSearch} />,
      ...(theme ? {
        headerStyle: { backgroundColor: campaignHeaderColor(theme) },
        headerTintColor: theme.title,
        headerShadowVisible: false,
      } : {
        headerTitle: () => (
          <BarTitle
            title={(language && collection.translations?.[language]?.title) || collection.title}
            subtitle={(language && collection.translations?.[language]?.subtitle) || collection.subtitle}
          />
        ),
      }),
    });
  }, [collection, language, navigation, theme, onSearch]);
  return theme;
}

interface HeadProps {
  collection: Collection;
  aisle: string | undefined;
  onAisle: (a: string | undefined) => void;
  /** Present while searching: the field takes the place of the collection's header */
  search: { query: string; onQuery: (q: string) => void; onCancel: () => void } | null;
}

function ListHead({ collection, aisle, onAisle, search }: HeadProps) {
  const accent = collection.campaign?.theme.title ?? colors.primary;
  if (search) {
    return (
      <View>
        <CollectionSearchField value={search.query} onChange={search.onQuery} onCancel={search.onCancel} accent={accent} />
        {collection.aisles && collection.aisles.length > 0 ? (
          <AisleChips aisles={collection.aisles} selected={aisle} onSelect={onAisle} accent={accent} />
        ) : null}
      </View>
    );
  }
  return (
    <View style={collection.campaign ? null : styles.head}>
      {collection.campaign
        ? <CampaignHeader collection={collection} campaign={collection.campaign} />
        : <CollectionBanner collection={collection} />}
      {collection.aisles && collection.aisles.length > 0 ? (
        <AisleChips aisles={collection.aisles} selected={aisle} onSelect={onAisle} accent={accent} />
      ) : null}
    </View>
  );
}

const SEARCH_DEBOUNCE_MS = 300;

/** The search toggled from the bar's icon; the products follow the query once typing pauses */
function useCollectionSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);
  const onOpen = useCallback(() => setOpen(true), []);
  const onCancel = useCallback(() => {
    setOpen(false);
    setQuery("");
  }, []);
  return { open, query, setQuery, onOpen, onCancel, q: open ? debounced : "" };
}

export default function CollectionScreen() {
  const { id, subcategoryIds } = useLocalSearchParams<{ id: string; subcategoryIds?: string }>();
  const { selectedStore } = useStore();
  const t = useStrings("home");
  // An aisle tile on the Home card opens the screen with that aisle already picked
  const [aisle, setAisle] = useState(subcategoryIds);
  const search = useCollectionSearch();
  const { collection, products, loading, loadingMore, failed, loadMore } = useCollectionProducts(id, selectedStore?.id, aisle, search.q || undefined);
  const theme = useCollectionBar(collection, search.onOpen);

  if (loading && !collection) return <Loader style={styles.spinner} />;
  if (failed || !collection) return <Message icon="cloud-offline-outline" text={t.offerUnavailable} />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={[styles.container, theme && { backgroundColor: theme.background }]}>
        <ProductList
          products={products}
          layout="grid"
          elevated={Boolean(theme)}
          contentContainerStyle={styles.grid}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          ListHeaderComponent={
            <ListHead
              collection={collection}
              aisle={aisle}
              onAisle={setAisle}
              search={search.open ? { query: search.query, onQuery: search.setQuery, onCancel: search.onCancel } : null}
            />
          }
          ListEmptyComponent={loading
            ? <Loader style={styles.more} />
            : search.q
              ? <Message icon="search-outline" text={t.noMatches(search.q)} />
              : <Message icon="basket-outline" text={t.offerOutOfStock} />}
          ListFooterComponent={loadingMore ? <Loader style={styles.more} /> : null}
        />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  grid: { paddingBottom: 120 },
  spinner: { marginTop: 48 },
  more: { marginVertical: 16 },
  message: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 10 },
  head: { paddingTop: 16 },
  // The icon font adds room above the glyph; a line exactly as tall as the icon centres it in the bar's button
  searchIcon: { lineHeight: 22 },
  searchButton: { width: 36, alignItems: "center" },
  barTitle: { alignItems: "center" },
  barTitleText: { fontFamily: fonts.bold, fontSize: 17, color: colors.text },
  barSubtitle: { fontFamily: fonts.medium, fontSize: 13, color: colors.textSecondary },
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
