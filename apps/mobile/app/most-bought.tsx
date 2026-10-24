import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors, fonts } from "../constants/theme";
import { api } from "../lib/api";
import { useStore } from "../lib/store-context";
import { useStrings } from "../lib/i18n/use-strings";
import { ProductActionsProvider } from "../lib/product-actions";
import type { StoreProduct } from "../lib/types";
import { ProductList } from "../components/ProductList";
import { FloatingCart } from "../components/FloatingCart";

function Message({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  return (
    <View style={styles.message}>
      <Ionicons name={icon} size={28} color={colors.textSecondary} />
      <Text style={styles.messageText}>{text}</Text>
    </View>
  );
}

function useMostBought(storeId: string | undefined) {
  const [products, setProducts] = useState<StoreProduct[] | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!storeId) return;
    api.get<StoreProduct[]>(`/api/v1/home/${storeId}/most-bought`)
      .then((res) => setProducts(res.data))
      .catch(() => setFailed(true));
  }, [storeId]);
  return { products, failed };
}

/** The store's best sellers over the last 30 days, opened from the most-bought hero card */
export default function MostBoughtScreen() {
  const { selectedStore } = useStore();
  const t = useStrings("home");
  const { products, failed } = useMostBought(selectedStore?.id);

  if (failed) return <Message icon="cloud-offline-outline" text={t.mostBoughtUnavailable} />;
  if (!products) return <ActivityIndicator style={styles.spinner} color={colors.primary} />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <ProductList
          products={products}
          layout="grid"
          numColumns={3}
          contentContainerStyle={styles.grid}
          ListEmptyComponent={<Message icon="bag-outline" text={t.mostBoughtEmpty} />}
        />
        <FloatingCart />
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  grid: { paddingTop: 12, paddingBottom: 120 },
  spinner: { marginTop: 48 },
  message: { alignItems: "center", paddingTop: 64, paddingHorizontal: 32, gap: 10 },
  messageText: { fontFamily: fonts.medium, fontSize: 14, color: colors.textSecondary, textAlign: "center" },
});
