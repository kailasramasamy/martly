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
  Dimensions,
  RefreshControl,
  Image,
} from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "../../lib/api";
import { useStore } from "../../lib/store-context";
import { useCart } from "../../lib/cart-context";
import { useWishlist } from "../../lib/wishlist-context";
import { useAuth } from "../../lib/auth-context";
import { colors, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { FeaturedProductCard } from "../../components/FeaturedProductCard";
import { ConfirmSheet } from "../../components/ConfirmSheet";
import { HomeScreenSkeleton } from "../../components/SkeletonLoader";
import type { Store, StoreProduct, HomeFeed } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;

const TIME_SUBTITLES: Record<string, string> = {
  morning: "Start your morning right",
  afternoon: "Afternoon picks",
  evening: "Evening essentials",
  night: "Late night cravings",
};

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  if (h < 21) return "Good evening";
  return "Good night";
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { stores, selectedStore, setSelectedStore, loading: storesLoading } = useStore();
  const { storeId: cartStoreId, items: cartItems, addItem, updateQuantity, productQuantityMap } = useCart();
  const { wishlistedIds, isWishlisted, toggle: toggleWishlist } = useWishlist();
  const { user } = useAuth();

  const [homeFeed, setHomeFeed] = useState<HomeFeed | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [replaceCartConfirm, setReplaceCartConfirm] = useState<{ pending: () => void } | null>(null);

  const fetchHomeFeed = useCallback(() => {
    if (!selectedStore) {
      setHomeFeed(null);
      return;
    }
    setLoadingFeed(true);
    api
      .get<HomeFeed>(`/api/v1/home/${selectedStore.id}`)
      .then((res) => setHomeFeed(res.data))
      .catch(() => {})
      .finally(() => setLoadingFeed(false));
  }, [selectedStore]);

  useEffect(() => {
    fetchHomeFeed();
  }, [fetchHomeFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    fetchHomeFeed();
    setTimeout(() => setRefreshing(false), 600);
  }, [fetchHomeFeed]);

  const cartQuantityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of cartItems) {
      map.set(item.storeProductId, item.quantity);
    }
    return map;
  }, [cartItems]);


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
        productId: sp.product.id,
        productName: sp.product.name,
        variantId: sp.variant.id,
        variantName: sp.variant.name,
        price: effectivePrice,
        imageUrl: sp.product.imageUrl ?? sp.variant.imageUrl,
      };

      if (cartStoreId && cartStoreId !== selectedStore.id) {
        setReplaceCartConfirm({
          pending: () => addItem(selectedStore.id, selectedStore.name, item),
        });
        return;
      }

      addItem(selectedStore.id, selectedStore.name, item);
    },
    [selectedStore, cartStoreId, addItem],
  );

  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      router.push({ pathname: "/category/[id]", params: { id: categoryId } });
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

  const renderProductList = useCallback(
    (products: StoreProduct[]) => (
      <FlatList
        horizontal
        data={products}
        keyExtractor={(item) => item.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.productList}
        renderItem={({ item }) => {
          const vc = (item as any).variantCount ?? 1;
          // For multi-variant: show total qty across all variants; for single: show base qty
          const qty = vc > 1
            ? (productQuantityMap.get(item.product.id) ?? 0)
            : (cartQuantityMap.get(item.id) ?? 0);
          return (
            <FeaturedProductCard
              item={item}
              onAddToCart={handleAddToCart}
              onUpdateQuantity={updateQuantity}
              quantity={qty}
              storeId={selectedStore?.id}
              variantCount={vc}
              onShowVariants={() => {
                const params: Record<string, string> = { id: item.product.id };
                if (selectedStore) params.storeId = selectedStore.id;
                router.push({ pathname: "/product/[id]", params });
              }}
              isWishlisted={isWishlisted(item.product.id)}
              onToggleWishlist={toggleWishlist}
            />
          );
        }}
      />
    ),
    [handleAddToCart, updateQuantity, cartQuantityMap, productQuantityMap, selectedStore, wishlistedIds],
  );

  if (storesLoading) return <HomeScreenSkeleton />;

  return (
    <View style={styles.container}>
      {/* ── Fixed Header ── */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
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
        {/* ── Greeting Section ── */}
        {selectedStore && user && (
          <View style={styles.greetingSection}>
            <View style={styles.greetingRow}>
              <View style={styles.greetingAvatarCircle}>
                <Text style={styles.greetingAvatarText}>
                  {(user.name || "U").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.greetingHi}>
                  {getTimeGreeting()}, {(user.name || "").split(" ")[0] || "there"}!
                </Text>
                <Text style={styles.greetingSub}>What would you like to order today?</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Promo Banner ── */}
        {selectedStore && (
          <View style={styles.bannerSection}>
            <View style={styles.banner}>
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
                    onPress={() => router.push({ pathname: "/search", params: { hasDiscount: "true" } } as any)}
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
        )}

        {/* ── Buy Again (top priority for returning customers) ── */}
        {homeFeed && homeFeed.buyAgain.length > 0 && (
          <View style={styles.buyAgainSection}>
            <View style={styles.buyAgainHeader}>
              <View style={styles.buyAgainTitleRow}>
                <View style={styles.buyAgainIcon}>
                  <Ionicons name="repeat" size={14} color="#fff" />
                </View>
                <View>
                  <Text style={styles.buyAgainTitle}>Buy Again</Text>
                  <Text style={styles.buyAgainSubtitle}>Your frequently ordered items</Text>
                </View>
              </View>
            </View>
            {renderProductList(homeFeed.buyAgain)}
          </View>
        )}

        {/* ── Curated Collections ── */}
        {homeFeed?.collections.map((collection) => (
          <View key={collection.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{collection.title}</Text>
                {collection.subtitle && (
                  <Text style={styles.sectionSubtitle}>{collection.subtitle}</Text>
                )}
              </View>
            </View>
            {renderProductList(collection.products)}
          </View>
        ))}

        {/* ── Shop by Category ── */}
        {homeFeed && homeFeed.categories.length > 0 && (
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
              {homeFeed.categories.map((cat, idx) => {
                const icon = getCategoryIcon(cat.name);
                const palette = GRID_PALETTES[idx % GRID_PALETTES.length];

                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.categoryGridItem}
                    onPress={() => handleCategoryPress(cat.id)}
                    activeOpacity={0.7}
                  >
                    {cat.imageUrl ? (
                      <View style={[styles.categoryGridIcon, { backgroundColor: palette.bg }]}>
                        <Image source={{ uri: cat.imageUrl }} style={styles.categoryGridImage} resizeMode="contain" />
                      </View>
                    ) : (
                      <View style={[styles.categoryGridIcon, { backgroundColor: palette.bg }]}>
                        <Ionicons name={icon} size={24} color={palette.color} />
                      </View>
                    )}
                    <Text style={styles.categoryGridLabel} numberOfLines={2}>{cat.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* ── Time-Aware Spotlight ── */}
        {homeFeed?.timeCategories.map((tc) => (
          <View key={tc.id} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>{tc.name}</Text>
                <Text style={styles.sectionSubtitle}>
                  {TIME_SUBTITLES[homeFeed.timePeriod] ?? ""}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleCategoryPress(tc.id)}
                style={styles.seeAllBtn}
              >
                <Text style={styles.seeAllText}>View All</Text>
                <Ionicons name="chevron-forward" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>
            {renderProductList(tc.products)}
          </View>
        ))}

        {/* ── Deals of the Day ── */}
        {homeFeed && homeFeed.deals.length > 0 && (
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
            {renderProductList(homeFeed.deals)}
          </View>
        )}

        {/* ── Loading state ── */}
        {selectedStore && loadingFeed && !homeFeed && (
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

      <ConfirmSheet
        visible={replaceCartConfirm !== null}
        title="Replace Cart?"
        message="Your cart has items from another store. Adding this item will replace your current cart."
        icon="cart-outline"
        iconColor="#f59e0b"
        confirmLabel="Replace"
        onConfirm={() => {
          replaceCartConfirm?.pending();
          setReplaceCartConfirm(null);
        }}
        onCancel={() => setReplaceCartConfirm(null)}
      />

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
    paddingTop: 12,
    paddingBottom: 4,
  },
  greetingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  greetingAvatarCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  greetingAvatarText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#fff",
  },
  greetingHi: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  greetingSub: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
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

  // ── Buy Again ──
  buyAgainSection: {
    marginTop: 16,
    backgroundColor: "#f0fdf4",
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#dcfce7",
  },
  buyAgainHeader: {
    paddingHorizontal: H_PADDING,
    marginBottom: 14,
  },
  buyAgainTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  buyAgainIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  buyAgainTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.text,
  },
  buyAgainSubtitle: {
    fontSize: 12,
    color: "#64748b",
    marginTop: 1,
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
    width: 80,
    height: 80,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  categoryGridImage: {
    width: 64,
    height: 64,
    borderRadius: 18,
  },
  categoryGridLabel: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.text,
    marginTop: 6,
    textAlign: "center",
  },

  // ── Product Lists ──
  productList: {
    paddingHorizontal: H_PADDING,
  },
  loadingRow: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
    gap: 12,
    marginTop: 24,
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
