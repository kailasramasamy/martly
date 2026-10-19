import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStore } from "../../lib/store-context";
import { useLanguage } from "../../lib/language-context";
import { ProductActionsProvider } from "../../lib/product-actions";
import { useCollectionProducts } from "../../lib/use-collection-products";
import { ProductList } from "../../components/ProductList";
import { FloatingCart } from "../../components/FloatingCart";
import { CollectionBanner } from "../../components/collection/CollectionBanner";
import { CampaignHeader, campaignHeaderColor } from "../../components/collection/CampaignHeader";
import { AisleChips } from "../../components/collection/AisleChips";
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

/** A campaign's screen wears its colours from the navigation bar down, matching its Home card; its headline already
 *  names it, so the bar keeps just the back arrow */
function useCollectionBar(collection: Collection | null) {
  const navigation = useNavigation();
  const { language } = useLanguage();
  const theme = collection?.campaign?.theme ?? null;
  useLightStatusBar(Boolean(theme?.dark));
  useEffect(() => {
    if (!collection) return;
    navigation.setOptions({
      title: theme ? "" : (language && collection.translations?.[language]?.title) || collection.title,
      ...(theme ? {
        headerBackButtonDisplayMode: "minimal" as const,
        headerStyle: { backgroundColor: campaignHeaderColor(theme) },
        headerTintColor: theme.title,
        headerShadowVisible: false,
      } : {}),
    });
  }, [collection, language, navigation, theme]);
  return theme;
}

function ListHead({ collection, aisle, onAisle }: { collection: Collection; aisle: string | undefined; onAisle: (a: string | undefined) => void }) {
  return (
    <View>
      {collection.campaign
        ? <CampaignHeader collection={collection} campaign={collection.campaign} />
        : <CollectionBanner collection={collection} />}
      {collection.aisles && collection.aisles.length > 0 ? (
        <AisleChips aisles={collection.aisles} selected={aisle} onSelect={onAisle} accent={collection.campaign?.theme.title ?? colors.primary} />
      ) : null}
    </View>
  );
}

export default function CollectionScreen() {
  const { id, subcategoryIds } = useLocalSearchParams<{ id: string; subcategoryIds?: string }>();
  const { selectedStore } = useStore();
  // An aisle tile on the Home card opens the screen with that aisle already picked
  const [aisle, setAisle] = useState(subcategoryIds);
  const { collection, products, loading, loadingMore, failed, loadMore } = useCollectionProducts(id, selectedStore?.id, aisle);
  const theme = useCollectionBar(collection);

  if (loading && !collection) return <ActivityIndicator style={styles.spinner} color={colors.primary} />;
  if (failed || !collection) return <Message icon="cloud-offline-outline" text="This offer isn't available right now." />;

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
          ListHeaderComponent={<ListHead collection={collection} aisle={aisle} onAisle={setAisle} />}
          ListEmptyComponent={loading
            ? <ActivityIndicator style={styles.more} color={colors.primary} />
            : <Message icon="basket-outline" text="Nothing from this offer is in stock at your store right now" />}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.more} color={colors.primary} /> : null}
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
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
