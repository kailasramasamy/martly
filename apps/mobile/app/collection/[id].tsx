import { useEffect } from "react";
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

function Message({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.message}>
      <Ionicons name={icon} size={28} color={colors.textSecondary} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { selectedStore } = useStore();
  const { language } = useLanguage();
  const storeId = selectedStore?.id;
  const { collection, products, loading, loadingMore, failed, loadMore } = useCollectionProducts(id, storeId);

  useEffect(() => {
    if (!collection) return;
    navigation.setOptions({ title: (language && collection.translations?.[language]?.title) || collection.title });
  }, [collection, language, navigation]);

  if (loading) return <ActivityIndicator style={styles.spinner} color={colors.primary} />;
  if (failed || !collection) return <Message icon="cloud-offline-outline" text="This offer isn't available right now." />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <ProductList
          products={products}
          layout="grid"
          contentContainerStyle={styles.grid}
          onEndReached={loadMore}
          onEndReachedThreshold={0.6}
          ListHeaderComponent={<CollectionBanner collection={collection} />}
          ListEmptyComponent={<Message icon="basket-outline" text="Nothing from this offer is in stock at your store right now" />}
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
