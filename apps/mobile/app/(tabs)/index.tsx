import { useEffect, useState, useMemo, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  Dimensions,
  RefreshControl,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store-context";
import { useCart } from "../../lib/cart-context";
import { colors, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { FeaturedProductCard } from "../../components/FeaturedProductCard";
import { HomeScreenSkeleton } from "../../components/SkeletonLoader";
import type { Store, StoreProduct, CategoryTreeNode, Brand } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { stores, selectedStore, setSelectedStore, loading: storesLoading } = useStore();
  const { storeId: cartStoreId, items: cartItems, addItem, updateQuantity } = useCart();

  const [categories, setCategories] = useState<CategoryTreeNode[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [deals, setDeals] = useState<StoreProduct[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = useCallback(() => {
    api
      .get<CategoryTreeNode[]>("/api/v1/categories/tree")
      .then((res) => setCategories(res.data))
      .catch(() => {});
  }, []);

  const fetchProducts = useCallback(() => {
    if (!selectedStore) {
      setProducts([]);
      return;
    }
    setLoadingProducts(true);
    api
      .getList<StoreProduct>(`/api/v1/stores/${selectedStore.id}/products?pageSize=20&isFeatured=true`)
      .then((res) => setProducts(res.data))
      .catch(() => {})
      .finally(() => setLoadingProducts(false));
  }, [selectedStore]);

  const fetchDeals = useCallback(() => {
    if (!selectedStore) {
      setDeals([]);
      return;
    }
    api
      .getList<StoreProduct>(`/api/v1/stores/${selectedStore.id}/products?hasDiscount=true&pageSize=10`)
      .then((res) => setDeals(res.data))
      .catch(() => {});
  }, [selectedStore]);

  const fetchBrands = useCallback(() => {
    api
      .getList<Brand>("/api/v1/brands?pageSize=12")
      .then((res) => setBrands(res.data))
      .catch(() => {});
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchCategories();
    fetchBrands();
  }, [fetchCategories, fetchBrands]);

  useEffect(() => {
    fetchProducts();
    fetchDeals();
  }, [fetchProducts, fetchDeals]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchCategories();
    fetchProducts();
    fetchDeals();
    fetchBrands();
    // Brief delay so spinner is visible
    setTimeout(() => setRefreshing(false), 600);
  }, [fetchCategories, fetchProducts, fetchDeals, fetchBrands]);

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.storeProductId, item.quantity);
    }
    return map;
  }, [cartItems]);

  // Flatten tree into popular subcategories for the 2x4 grid
  // Prioritize "Food" subcategories, then fill from other parents
  const gridCategories = useMemo(() => {
    const food = categories.find((c) => c.name.toLowerCase() === "food");
    const subs: CategoryTreeNode[] = food ? [...food.children] : [];
    for (const parent of categories) {
      if (parent === food) continue;
      for (const child of parent.children) {
        subs.push(child);
      }
    }
    return subs.slice(0, 8);
  }, [categories]);

  const filteredStores = useMemo(() => {
    if (!storeSearch) return stores;
    const q = storeSearch.toLowerCase();
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q),
    );
  }, [stores, storeSearch]);

  const handleAddToCart = useCallback(
    (sp: StoreProduct) => {
      if (!selectedStore) return;

      const effectivePrice = sp.pricing?.discountActive
        ? sp.pricing.effectivePrice
        : Number(sp.price);

      const item = {
        storeProductId: sp.id,
        productName: sp.product.name,
        variantId: sp.variant.id,
        variantName: sp.variant.name,
        price: effectivePrice,
        imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl,
      };

      if (cartStoreId && cartStoreId !== selectedStore.id) {
        Alert.alert(
          "Replace Cart?",
          "Your cart has items from another store. Adding this item will replace your current cart.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Replace",
              style: "destructive",
              onPress: () => addItem(selectedStore.id, selectedStore.name, item),
            },
          ],
        );
        return;
      }

      addItem(selectedStore.id, selectedStore.name, item);
    },
    [selectedStore, cartStoreId, addItem],
  );

  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      router.push({ pathname: "/search", params: { categoryId } });
    },
    [],
  );

  const selectStore = useCallback(
    (store: Store) => {
      setSelectedStore(store);
      setShowStorePicker(false);
      setStoreSearch("");
    },
    [setSelectedStore],
  );

  if (storesLoading) return <HomeScreenSkeleton />;

  return (
    <View style={styles.container}>
      {/* ── Fixed Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        {/* Store selector row */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.storeSelector} onPress={() => setShowStorePicker(true)}>
            <View style={styles.locationIcon}>
              <Ionicons name="location-sharp" size={18} color={colors.primary} />
            </View>
            <View style={styles.storeInfo}>
              <Text style={styles.deliverLabel}>DELIVER TO</Text>
              <View style={styles.storeNameRow}>
                <Text style={styles.storeName} numberOfLines={1}>
                  {selectedStore ? selectedStore.name : "Select a store"}
                </Text>
                <Ionicons name="chevron-down" size={14} color="#64748b" />
              </View>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/(tabs)/profile")}>
            <Ionicons name="person-outline" size={20} color={colors.text} />
          </TouchableOpacity>
        </View>

        {/* Search bar */}
        <TouchableOpacity style={styles.searchBar} onPress={() => router.push("/search")}>
          <Ionicons name="search-outline" size={18} color="#94a3b8" />
          <Text style={styles.searchPlaceholder}>Search groceries, brands...</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      >
        {/* ── Greeting + Banner ── */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>{getGreeting()} !</Text>
          <Text style={styles.greetingSubtext}>What would you like to order?</Text>
        </View>

        {/* ── Promo Banner ── */}
        <View style={styles.bannerSection}>
          <View style={styles.banner}>
            {/* Decorative circles */}
            <View style={styles.bannerCircle1} />
            <View style={styles.bannerCircle2} />
            <View style={styles.bannerContent}>
              <View style={styles.bannerLeft}>
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>LIMITED TIME</Text>
                </View>
                <Text style={styles.bannerTitle}>Fresh Organics{"\n"}Weekly Deals</Text>
                <Text style={styles.bannerSubtitle}>Up to 30% Off on fresh produce</Text>
                <TouchableOpacity
                  style={styles.bannerBtn}
                  onPress={() => selectedStore && router.push(`/store/${selectedStore.id}`)}
                >
                  <Text style={styles.bannerBtnText}>Shop Now</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.bannerIconBox}>
                <Ionicons name="leaf" size={48} color="rgba(255,255,255,0.3)" />
              </View>
            </View>
          </View>
        </View>

        {/* ── Categories 2×4 Grid ── */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionCardHeader}>
            <Text style={styles.sectionTitle}>Shop by Category</Text>
            <TouchableOpacity
              onPress={() => router.push("/(tabs)/categories")}
              style={styles.seeAllBtn}
            >
              <Text style={styles.seeAllText}>See All</Text>
              <Ionicons name="chevron-forward" size={14} color={colors.primary} />
            </TouchableOpacity>
          </View>
          <View style={styles.categoryGrid}>
            {(gridCategories.length > 0 ? gridCategories : PLACEHOLDER_CATEGORIES.slice(0, 8)).map((cat) => {
              const isApi = "id" in cat;
              const name = isApi ? (cat as CategoryTreeNode).name : (cat as (typeof PLACEHOLDER_CATEGORIES)[0]).name;
              const icon = isApi
                ? getCategoryIcon(name)
                : ((cat as (typeof PLACEHOLDER_CATEGORIES)[0]).icon as any);
              const bg = isApi ? GRID_PALETTES[name.length % GRID_PALETTES.length].bg : (cat as (typeof PLACEHOLDER_CATEGORIES)[0]).bg;
              const fg = isApi ? GRID_PALETTES[name.length % GRID_PALETTES.length].color : (cat as (typeof PLACEHOLDER_CATEGORIES)[0]).color;

              return (
                <TouchableOpacity
                  key={isApi ? (cat as CategoryTreeNode).id : name}
                  style={styles.categoryGridItem}
                  onPress={() =>
                    isApi
                      ? handleCategoryPress((cat as CategoryTreeNode).id)
                      : router.push("/search")
                  }
                  activeOpacity={0.7}
                >
                  <View style={[styles.categoryGridIcon, { backgroundColor: bg }]}>
                    <Ionicons name={icon} size={24} color={fg} />
                  </View>
                  <Text style={styles.categoryGridLabel} numberOfLines={1}>{name}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Quick Links ── */}
        <View style={styles.quickLinksStrip}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickLinksRow}>
            {QUICK_LINKS.map((link) => (
              <TouchableOpacity
                key={link.label}
                style={styles.quickLinkChip}
                onPress={() => router.push({ pathname: "/search", params: link.params } as any)}
                activeOpacity={0.7}
              >
                <Ionicons name={link.icon as any} size={15} color={link.color} />
                <Text style={styles.quickLinkChipText}>{link.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* ── Featured Products ── */}
        {selectedStore && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Featured Products</Text>
                <Text style={styles.sectionSubtitle}>Handpicked just for you</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push(`/store/${selectedStore.id}`)}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>

            {loadingProducts ? (
              <View style={styles.loadingRow}>
                {[1, 2, 3].map((i) => (
                  <View key={i} style={styles.productSkeleton}>
                    <View style={styles.productSkeletonImage} />
                    <View style={styles.productSkeletonContent}>
                      <View style={styles.skeletonLine} />
                      <View style={[styles.skeletonLine, styles.skeletonLineShort]} />
                    </View>
                  </View>
                ))}
              </View>
            ) : products.length > 0 ? (
              <FlatList
                horizontal
                data={products}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.featuredList}
                renderItem={({ item }) => (
                  <FeaturedProductCard
                    item={item}
                    onAddToCart={handleAddToCart}
                    onUpdateQuantity={updateQuantity}
                    quantity={cartQuantityMap.get(item.id) ?? 0}
                    storeId={selectedStore?.id}
                  />
                )}
              />
            ) : (
              <View style={styles.emptyProducts}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="pricetag-outline" size={28} color="#94a3b8" />
                </View>
                <Text style={styles.emptyTitle}>No featured products yet</Text>
                <Text style={styles.emptySubtitle}>Check back soon for curated picks</Text>
              </View>
            )}
          </View>
        )}

        {/* ── Deals of the Day ── */}
        {deals.length > 0 && (
          <View style={styles.dealsSection}>
            <View style={styles.dealsSectionHeader}>
              <View style={styles.dealsTitleRow}>
                <View style={styles.dealsIcon}>
                  <Ionicons name="flash" size={14} color="#fff" />
                </View>
                <Text style={styles.dealsSectionTitle}>Deals of the Day</Text>
              </View>
              <TouchableOpacity
                onPress={() => router.push({ pathname: "/search", params: { hasDiscount: "true" } } as any)}
                style={styles.seeAllBtnDark}
              >
                <Text style={styles.seeAllTextDark}>View All</Text>
                <Ionicons name="chevron-forward" size={14} color="#92400e" />
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.dealsRow}>
              {deals.map((deal) => {
                const savings = deal.pricing?.discountActive
                  ? deal.pricing.savingsPercent > 0
                    ? `${Math.round(deal.pricing.savingsPercent)}% OFF`
                    : `\u20B9${Math.round(deal.pricing.savingsAmount)} OFF`
                  : "";
                const effectivePrice = deal.pricing?.effectivePrice ?? Number(deal.price);
                const originalPrice = deal.pricing?.originalPrice ?? Number(deal.price);

                return (
                  <TouchableOpacity
                    key={deal.id}
                    style={styles.dealCard}
                    onPress={() => router.push(`/product/${deal.product.id}` as any)}
                    activeOpacity={0.7}
                  >
                    <View style={[styles.dealIconWrap, { backgroundColor: "#fee2e2" }]}>
                      <Ionicons name="pricetag" size={24} color="#ef4444" />
                    </View>
                    <View style={styles.dealContent}>
                      <Text style={styles.dealTitle} numberOfLines={1}>{deal.product.name}</Text>
                      <View style={styles.dealPriceRow}>
                        <Text style={styles.dealPrice}>{"\u20B9"}{Math.round(effectivePrice)}</Text>
                        {deal.pricing?.discountActive && (
                          <Text style={styles.dealOriginalPrice}>{"\u20B9"}{Math.round(originalPrice)}</Text>
                        )}
                      </View>
                      {savings ? (
                        <View style={styles.dealBadge}>
                          <Text style={styles.dealBadgeText}>{savings}</Text>
                        </View>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ── Second Banner ── */}
        <View style={styles.bannerSection}>
          <View style={[styles.banner, { backgroundColor: "#1e3a5f" }]}>
            <View style={styles.bannerCircle1} />
            <View style={styles.bannerCircle2} />
            <View style={styles.bannerContent}>
              <View style={styles.bannerLeft}>
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>EVERYDAY ESSENTIALS</Text>
                </View>
                <Text style={styles.bannerTitle}>Personal Care{"\n"}& Household</Text>
                <Text style={styles.bannerSubtitle}>Stock up on daily essentials</Text>
                <TouchableOpacity
                  style={[styles.bannerBtn, { backgroundColor: "#3b82f6" }]}
                  onPress={() => selectedStore ? router.push(`/store/${selectedStore.id}`) : router.push("/search")}
                >
                  <Text style={styles.bannerBtnText}>Explore</Text>
                  <Ionicons name="arrow-forward" size={14} color="#fff" />
                </TouchableOpacity>
              </View>
              <View style={styles.bannerIconBox}>
                <Ionicons name="sparkles" size={48} color="rgba(255,255,255,0.3)" />
              </View>
            </View>
          </View>
        </View>

        {/* ── Popular Brands ── */}
        {brands.length > 0 && (
          <View style={styles.brandsSection}>
            <View style={styles.brandsSectionInner}>
              <View style={styles.sectionHeader}>
                <View style={styles.brandsTitleRow}>
                  <View style={styles.brandsIcon}>
                    <Ionicons name="star" size={12} color="#7c3aed" />
                  </View>
                  <Text style={styles.sectionTitle}>Popular Brands</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.brandsRow}>
                {brands.map((brand, idx) => {
                  const palette = BRAND_PALETTES[idx % BRAND_PALETTES.length];
                  return (
                    <TouchableOpacity
                      key={brand.id}
                      style={styles.brandCard}
                      onPress={() => router.push({ pathname: "/search", params: { q: brand.name } } as any)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.brandCircle, { backgroundColor: palette.bg }]}>
                        <Text style={[styles.brandLetter, { color: palette.color }]}>
                          {brand.name[0]?.toUpperCase() ?? "?"}
                        </Text>
                      </View>
                      <Text style={styles.brandName} numberOfLines={1}>{brand.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </View>
        )}

        {/* ── Browse All CTA ── */}
        {selectedStore && (
          <View style={styles.ctaSection}>
            <TouchableOpacity
              style={styles.ctaCard}
              onPress={() => router.push(`/store/${selectedStore.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.ctaLeft}>
                <Text style={styles.ctaTitle}>Browse All Products</Text>
                <Text style={styles.ctaSubtitle}>
                  Explore everything at {selectedStore.name}
                </Text>
              </View>
              <View style={styles.ctaArrow}>
                <Ionicons name="arrow-forward" size={20} color={colors.primary} />
              </View>
            </TouchableOpacity>
          </View>
        )}


        {/* ── Welcome (no store selected) ── */}
        {!selectedStore && (
          <View style={styles.welcomeSection}>
            <View style={styles.welcomeCard}>
              <View style={styles.welcomeIconCircle}>
                <Ionicons name="storefront-outline" size={36} color={colors.primary} />
              </View>
              <Text style={styles.welcomeTitle}>Welcome to Martly</Text>
              <Text style={styles.welcomeSubtitle}>
                Select a store near you to start browsing fresh groceries and daily essentials
              </Text>
              <TouchableOpacity
                style={styles.welcomeBtn}
                onPress={() => setShowStorePicker(true)}
              >
                <Ionicons name="location-outline" size={18} color="#fff" />
                <Text style={styles.welcomeBtnText}>Choose a Store</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ── Store Picker Modal ── */}
      <Modal visible={showStorePicker} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Select Store</Text>
              <Text style={styles.modalSubtitle}>{stores.length} stores available</Text>
            </View>
            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => { setShowStorePicker(false); setStoreSearch(""); }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalSearchWrap}>
            <Ionicons name="search-outline" size={18} color="#94a3b8" />
            <TextInput
              style={styles.modalSearchInput}
              placeholder="Search by name or address..."
              value={storeSearch}
              onChangeText={setStoreSearch}
              autoCapitalize="none"
              autoCorrect={false}
              placeholderTextColor="#94a3b8"
            />
            {storeSearch.length > 0 && (
              <TouchableOpacity onPress={() => setStoreSearch("")}>
                <Ionicons name="close-circle" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>

          <FlatList
            data={filteredStores}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.modalList}
            renderItem={({ item }) => {
              const isSelected = selectedStore?.id === item.id;
              return (
                <TouchableOpacity
                  style={[styles.storeCard, isSelected && styles.storeCardActive]}
                  onPress={() => selectStore(item)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.storeCardIcon, isSelected && styles.storeCardIconActive]}>
                    <Ionicons
                      name="storefront"
                      size={18}
                      color={isSelected ? "#fff" : "#94a3b8"}
                    />
                  </View>
                  <View style={styles.storeCardInfo}>
                    <Text style={[styles.storeCardName, isSelected && styles.storeCardNameActive]}>
                      {item.name}
                    </Text>
                    <Text style={styles.storeCardAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                  {isSelected && (
                    <View style={styles.storeCardCheck}>
                      <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyProducts}>
                <Ionicons name="search" size={28} color="#94a3b8" />
                <Text style={styles.emptyTitle}>No stores found</Text>
                <Text style={styles.emptySubtitle}>Try a different search term</Text>
              </View>
            }
          />
        </View>
      </Modal>
    </View>
  );
}

// Pastel palettes for API-loaded categories
const GRID_PALETTES = [
  { bg: "#fee2e2", color: "#ef4444" },
  { bg: "#dcfce7", color: "#16a34a" },
  { bg: "#dbeafe", color: "#3b82f6" },
  { bg: "#fef3c7", color: "#d97706" },
  { bg: "#ffedd5", color: "#ea580c" },
  { bg: "#ede9fe", color: "#7c3aed" },
  { bg: "#fce7f3", color: "#ec4899" },
  { bg: "#e0f2fe", color: "#0284c7" },
];

// Quick link tiles with real destinations
const QUICK_LINKS = [
  { label: "Today's Deals", icon: "flash-outline", color: "#d97706", params: { hasDiscount: "true" } },
  { label: "Top Brands", icon: "star-outline", color: "#7c3aed", params: {} },
  { label: "New Arrivals", icon: "sparkles-outline", color: "#16a34a", params: { sortBy: "newest" } },
];

// Palettes for API-loaded brands
const BRAND_PALETTES = [
  { bg: "#fee2e2", color: "#dc2626" },
  { bg: "#dbeafe", color: "#2563eb" },
  { bg: "#fef3c7", color: "#d97706" },
  { bg: "#dcfce7", color: "#16a34a" },
  { bg: "#ffedd5", color: "#ea580c" },
  { bg: "#ede9fe", color: "#7c3aed" },
  { bg: "#fce7f3", color: "#db2777" },
  { bg: "#e0f2fe", color: "#0284c7" },
  { bg: "#d1fae5", color: "#047857" },
  { bg: "#e0e7ff", color: "#4338ca" },
];


// Fallback categories when API data hasn't loaded yet
const PLACEHOLDER_CATEGORIES = [
  { name: "Fruits", icon: "nutrition-outline", bg: "#fee2e2", color: "#ef4444" },
  { name: "Vegetables", icon: "leaf-outline", bg: "#dcfce7", color: "#16a34a" },
  { name: "Dairy", icon: "water-outline", bg: "#dbeafe", color: "#3b82f6" },
  { name: "Bakery", icon: "cafe-outline", bg: "#fef3c7", color: "#d97706" },
  { name: "Snacks", icon: "pizza-outline", bg: "#ffedd5", color: "#ea580c" },
  { name: "Beverages", icon: "wine-outline", bg: "#ede9fe", color: "#7c3aed" },
  { name: "Household", icon: "home-outline", bg: "#fce7f3", color: "#ec4899" },
  { name: "Personal Care", icon: "body-outline", bg: "#e0f2fe", color: "#0284c7" },
];

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8faf9" },

  // ── Header ──
  header: {
    backgroundColor: "#fff",
    paddingHorizontal: H_PADDING,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  storeSelector: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 10,
  },
  locationIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primary + "12",
    justifyContent: "center",
    alignItems: "center",
  },
  storeInfo: { flex: 1 },
  deliverLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#94a3b8",
    letterSpacing: 0.8,
    lineHeight: 12,
  },
  storeNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  storeName: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
    flexShrink: 1,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Search ──
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f1f5f9",
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  searchPlaceholder: { fontSize: 14, color: "#94a3b8" },

  // ── Scroll Content ──
  scrollContent: { paddingBottom: 8 },

  // ── Greeting ──
  greetingSection: {
    paddingHorizontal: H_PADDING,
    paddingTop: 20,
    paddingBottom: 4,
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.text,
  },
  greetingSubtext: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },

  // ── Banner ──
  bannerSection: {
    paddingHorizontal: H_PADDING,
    paddingTop: 16,
  },
  banner: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#14532d",
    position: "relative",
  },
  bannerCircle1: {
    position: "absolute",
    top: -30,
    right: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  bannerCircle2: {
    position: "absolute",
    bottom: -40,
    right: 40,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.04)",
  },
  bannerContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  bannerLeft: {
    flex: 1,
  },
  bannerBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
  },
  bannerBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.8,
  },
  bannerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
    lineHeight: 26,
  },
  bannerSubtitle: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255,255,255,0.7)",
    marginTop: 4,
  },
  bannerBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginTop: 12,
  },
  bannerBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  bannerIconBox: {
    width: 64,
    justifyContent: "center",
    alignItems: "center",
  },

  // ── Sections ──
  section: { marginTop: 24 },
  sectionCard: {
    marginTop: 20,
    marginHorizontal: H_PADDING,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: H_PADDING,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 1,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.primary,
  },

  // ── Categories Grid ──
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 16,
  },
  categoryGridItem: {
    width: (SCREEN_WIDTH - H_PADDING * 2 - 32 - 12 * 3) / 4,
    alignItems: "center",
  },
  categoryGridIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryGridLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    marginTop: 6,
    textAlign: "center",
  },

  // ── Quick Links ──
  quickLinksStrip: {
    marginTop: 16,
  },
  quickLinksRow: {
    paddingHorizontal: H_PADDING,
    gap: 8,
  },
  quickLinkChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 7,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  quickLinkChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
  },

  // ── Featured Products ──
  featuredList: {
    paddingHorizontal: H_PADDING,
  },
  loadingRow: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
    gap: 12,
  },
  productSkeleton: {
    width: 156,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
  },
  productSkeletonImage: {
    width: "100%",
    height: 100,
    backgroundColor: "#f1f5f9",
  },
  productSkeletonContent: {
    padding: 10,
    gap: 8,
  },
  skeletonLine: {
    height: 12,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    width: "80%",
  },
  skeletonLineShort: {
    width: "50%",
  },

  // ── Empty Products ──
  emptyProducts: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
    marginHorizontal: H_PADDING,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  emptyIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#f8fafc",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 4,
    textAlign: "center",
  },

  // ── Deals of the Day ──
  dealsSection: {
    marginTop: 24,
    backgroundColor: "#fffbeb",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#fef3c7",
  },
  dealsSectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: H_PADDING,
    marginBottom: 14,
  },
  dealsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dealsIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    backgroundColor: "#f59e0b",
    justifyContent: "center",
    alignItems: "center",
  },
  dealsSectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
  },
  seeAllBtnDark: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  seeAllTextDark: {
    fontSize: 13,
    fontWeight: "600",
    color: "#92400e",
  },
  // (timer row removed - using real deals now)
  dealsRow: {
    paddingHorizontal: H_PADDING,
    gap: 12,
  },
  dealCard: {
    width: 200,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  dealIconWrap: {
    width: 72,
    height: 88,
    justifyContent: "center",
    alignItems: "center",
  },
  dealContent: {
    flex: 1,
    paddingVertical: 10,
    paddingRight: 12,
    paddingLeft: 4,
  },
  dealTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  dealPriceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  dealPrice: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.text,
  },
  dealOriginalPrice: {
    fontSize: 11,
    color: "#94a3b8",
    textDecorationLine: "line-through",
  },
  dealSub: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  dealBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#dc2626",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
  },
  dealBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
    letterSpacing: 0.3,
  },

  // ── Popular Brands ──
  brandsSection: {
    marginTop: 24,
    backgroundColor: "#faf5ff",
    paddingVertical: 20,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#ede9fe",
  },
  brandsSectionInner: {},
  brandsTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandsIcon: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: "#ede9fe",
    justifyContent: "center",
    alignItems: "center",
  },
  brandsRow: {
    paddingHorizontal: H_PADDING,
    gap: 16,
  },
  brandCard: {
    alignItems: "center",
    width: 64,
  },
  brandCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: "#f1f5f9",
  },
  brandLetter: {
    fontSize: 20,
    fontWeight: "700",
  },
  brandName: {
    fontSize: 10,
    fontWeight: "600",
    color: colors.text,
    marginTop: 6,
    textAlign: "center",
  },


  // ── Browse All CTA ──
  ctaSection: {
    paddingHorizontal: H_PADDING,
    marginTop: 24,
  },
  ctaCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  ctaLeft: { flex: 1 },
  ctaTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },
  ctaSubtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  ctaArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary + "10",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 12,
  },

  // ── Welcome ──
  welcomeSection: {
    paddingHorizontal: H_PADDING,
    marginTop: 20,
  },
  welcomeCard: {
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 32,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  welcomeIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: colors.primary + "10",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  welcomeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  welcomeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },

  // ── Store Picker Modal ──
  modalContainer: { flex: 1, backgroundColor: "#f8faf9" },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: H_PADDING,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: colors.text,
  },
  modalSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    marginTop: 2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  modalSearchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 10,
    paddingHorizontal: 12,
    margin: H_PADDING,
    gap: 8,
  },
  modalSearchInput: {
    flex: 1,
    paddingVertical: 11,
    fontSize: 14,
    color: colors.text,
  },
  modalList: { paddingHorizontal: H_PADDING, paddingBottom: 24 },
  storeCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  storeCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + "06",
  },
  storeCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  storeCardIconActive: {
    backgroundColor: colors.primary,
  },
  storeCardInfo: { flex: 1 },
  storeCardName: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  storeCardNameActive: {
    color: colors.primary,
  },
  storeCardAddress: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 2,
  },
  storeCardCheck: {
    marginLeft: 8,
  },
});
