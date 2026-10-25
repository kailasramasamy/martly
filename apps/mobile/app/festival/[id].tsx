import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Loader } from "../../components/Loader";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../../constants/theme";
import { useStore } from "../../lib/store-context";
import { useLanguage } from "../../lib/language-context";
import { useStrings } from "../../lib/i18n/use-strings";
import { ProductActionsProvider } from "../../lib/product-actions";
import { useFestiveHero, useTileProducts } from "../../lib/use-festive";
import { ProductList } from "../../components/ProductList";
import { FloatingCart } from "../../components/FloatingCart";
import { TileChips } from "../../components/festival/TileChips";
import { AislePills } from "../../components/festival/AislePills";

function Message({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.message}>
      <Ionicons name={icon} size={28} color={colors.textSecondary} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

interface ShelfProps {
  collectionId: string;
  tileId: string;
  aisleId: string | null;
  storeId: string;
}

function TileShelf({ collectionId, tileId, aisleId, storeId }: ShelfProps) {
  const t = useStrings("home");
  const { products, loading, loadingMore, failed, loadMore } = useTileProducts(collectionId, tileId, storeId, aisleId);
  if (loading) return <Loader style={styles.spinner} />;
  if (failed) return <Message icon="cloud-offline-outline" text={t.tileFailed} />;
  if (products.length === 0) return <Message icon="basket-outline" text={t.tileEmpty} />;
  return (
    <ProductList
      products={products}
      layout="grid"
      contentContainerStyle={styles.grid}
      onEndReached={loadMore}
      onEndReachedThreshold={0.6}
      ListFooterComponent={loadingMore ? <Loader style={styles.more} /> : null}
    />
  );
}

export default function FestivalScreen() {
  const { id, tile } = useLocalSearchParams<{ id: string; tile?: string }>();
  const navigation = useNavigation();
  const { selectedStore } = useStore();
  const { language } = useLanguage();
  const t = useStrings("home");
  const storeId = selectedStore?.id;
  const { hero, loading } = useFestiveHero(id, storeId);
  const [tileId, setTileId] = useState<string | null>(tile ?? null);
  const [aisleId, setAisleId] = useState<string | null>(null);
  const selectTile = (id: string) => {
    setTileId(id);
    setAisleId(null);
  };

  const selected = hero?.tiles.find((t) => t.id === tileId) ?? hero?.tiles[0] ?? null;

  useEffect(() => {
    if (!hero) return;
    const { background, title } = hero.theme;
    navigation.setOptions({
      title: (language && hero.translations?.[language]?.title) || hero.title,
      headerStyle: { backgroundColor: background },
      headerTintColor: title,
      headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17, color: title },
      headerShadowVisible: false,
    });
  }, [hero, language, navigation]);

  if (loading) return <Loader style={styles.spinner} />;
  if (!hero || !selected || !storeId) return <Message icon="sparkles-outline" text={t.festivalEnded} />;

  // Light title ink only reads on the festive band; white chips and pills need the band colour instead
  const ink = hero.theme.dark ? hero.theme.background : hero.theme.title;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <View style={[styles.chips, { backgroundColor: hero.theme.background }]}>
          <TileChips tiles={hero.tiles} selectedId={selected.id} ink={ink} labelColor={hero.theme.title} onSelect={selectTile} />
        </View>
        <AislePills aisles={selected.subcategories} selectedId={aisleId} ink={ink} onSelect={setAisleId} />
        <TileShelf key={`${selected.id}|${aisleId}`} collectionId={hero.id} tileId={selected.id} aisleId={aisleId} storeId={storeId} />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  chips: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  grid: { paddingTop: 12, paddingBottom: 120 },
  spinner: { marginTop: 48 },
  more: { marginVertical: 16 },
  message: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 10 },
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
