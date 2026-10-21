import { Pressable, StyleSheet, View } from "react-native";
import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../constants/theme";
import { useCart } from "../../lib/cart-context";
import { useStore } from "../../lib/store-context";
import { TabIcon, TabSceneLayout, useTabBarOptions } from "../../components/TabIcon";
import { useStrings } from "../../lib/i18n/use-strings";
import { useBrandSpotlight } from "../../lib/use-brand-spotlight";
import { BrandTabSlot } from "../../components/BrandTabSlot";

export default function TabsLayout() {
  const { itemCount } = useCart();
  const t = useStrings("nav");
  const screenOptions = useTabBarOptions();
  const { selectedStore, loading } = useStore();
  const spotlight = useBrandSpotlight(selectedStore?.id);
  // Every tab depends on a store, so the bar waits until one is chosen
  const choosing = !loading && !selectedStore;

  return (
    <Tabs screenOptions={choosing ? { ...screenOptions, tabBarStyle: { display: "none" } } : screenOptions} screenLayout={TabSceneLayout}>
      <Tabs.Screen
        name="index"
        options={{ title: t.home, headerShown: false, tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="home" /> }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: t.categories,
          headerTitle: t.allCategories,
          headerRight: () => <CategoriesActions />,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="grid" />,
        }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: t.cart,
          tabBarAccessibilityLabel: itemCount > 0 ? t.cartWithCount(itemCount) : t.cart,
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="bag-handle" badge={itemCount} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: t.orders, tabBarIcon: ({ focused }) => <TabIcon focused={focused} icon="receipt" /> }}
      />
      {/* Never shown: the slot opens the spotlight brand's store (or the brands directory) on the root stack */}
      <Tabs.Screen name="brand-spot" options={{ tabBarItemStyle: spotlight ? { flex: 1.25 } : undefined, tabBarButton: () => <BrandTabSlot brand={spotlight} /> }} />
    </Tabs>
  );
}

/** Wishlist and search beside the Categories title, as the directory has no search bar of its own */
function CategoriesActions() {
  const t = useStrings("nav");
  return (
    <View style={styles.actions}>
      <Pressable onPress={() => router.push("/wishlist")} style={styles.action} accessibilityRole="button" accessibilityLabel={t.wishlist}>
        <Ionicons name="heart-outline" size={23} color={colors.text} />
      </Pressable>
      <Pressable onPress={() => router.push("/search")} style={styles.action} accessibilityRole="button" accessibilityLabel={t.search}>
        <Ionicons name="search-outline" size={23} color={colors.text} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", marginRight: 6 },
  action: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
});
