import { useEffect, useState, useMemo, useCallback, useRef } from "react";
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
import { LinearGradient } from "expo-linear-gradient";
import { RecipeCard } from "../../components/RecipeCard";
import { api } from "../../lib/api";
import { HomeBrandRail } from "../../components/HomeBrandRail";
import { useStore } from "../../lib/store-context";
import { useMembership } from "../../lib/membership-context";
import { useNotifications } from "../../lib/notification-context";
import { useBasketMode } from "../../lib/basket-mode-context";
import { useLanguage } from "../../lib/language-context";
import { colors, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { FEATURED_CARD_WIDTH } from "../../components/FeaturedProductCard";
import { ProductList } from "../../components/ProductList";
import { ProductActionsProvider } from "../../lib/product-actions";
import { FloatingCart } from "../../components/FloatingCart";
import { HomeScreenSkeleton } from "../../components/SkeletonLoader";
import StoreDiscovery from "../../components/store-discovery/StoreDiscovery";
import { HeroBannerSlide } from "../../components/HeroBannerSlide";
import { CategoryTile } from "../../components/CategoryTile";
import { TimeSpotlight } from "../../components/TimeSpotlight";
import { HomeHeaderLocation } from "../../components/HomeHeaderLocation";
import { SearchBarButton } from "../../components/SearchBarButton";
import { PlusPromoStrip } from "../../components/PlusPromoStrip";
import type { Store, StoreProduct, HomeFeed, Banner } from "../../lib/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;

// 4 tiles per row inside the padded section card
const CATEGORY_TILE_SIZE = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - 32 - 12 * 3) / 4);

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { stores, selectedStore, setSelectedStore, loading: storesLoading, userArea, refreshStores } = useStore();
  const { isMember } = useMembership();
  const { isBasketMode } = useBasketMode();
  const { getLocalizedName } = useLanguage();

  const [homeFeed, setHomeFeed] = useState<HomeFeed | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [showStorePicker, setShowStorePicker] = useState(false);
  const [storeSearch, setStoreSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [memberStatus, setMemberStatus] = useState<{ isMember: boolean; membership: { planName: string; endDate: string; daysLeft: number } | null } | null>(null);
  const [hasSubscriptions, setHasSubscriptions] = useState(false);
  const { unreadCount } = useNotifications();

  const fetchHomeFeed = useCallback(() => {
    if (!selectedStore) {
      setHomeFeed(null);
      setMemberStatus(null);
      return;
    }
    setLoadingFeed(true);
    api
      .get<HomeFeed>(`/api/v1/home/${selectedStore.id}`)
      .then((res) => setHomeFeed(res.data))
      .catch(() => {})
      .finally(() => setLoadingFeed(false));
    // Fetch membership status in parallel
    api
      .get<{ isMember: boolean; membership: { planName: string; endDate: string } | null }>(`/api/v1/memberships/status?storeId=${selectedStore.id}`)
      .then((res) => {
        const m = res.data.membership;
        const daysLeft = m ? Math.max(0, Math.ceil((new Date(m.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
        setMemberStatus({ isMember: res.data.isMember, membership: m ? { ...m, daysLeft } : null });
      })
      .catch(() => setMemberStatus(null));
    // Check for active subscriptions (only if store has subscriptions enabled)
    if (selectedStore.subscriptionEnabled) {
      api
        .getList<{ id: string }>(`/api/v1/subscriptions?storeId=${selectedStore.id}`)
        .then((res) => setHasSubscriptions(res.data.length > 0))
        .catch(() => setHasSubscriptions(false));
    } else {
      setHasSubscriptions(false);
    }
  }, [selectedStore]);

  useEffect(() => {
    fetchHomeFeed();
  }, [fetchHomeFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedStore) fetchHomeFeed();
    else await refreshStores();
    setTimeout(() => setRefreshing(false), 600);
  }, [fetchHomeFeed, refreshStores, selectedStore]);



  const filteredStores = useMemo(() => {
    if (!storeSearch) return stores;
    const q = storeSearch.toLowerCase();
    return stores.filter(
      (s) => s.name.toLowerCase().includes(q) || s.address.toLowerCase().includes(q),
    );
  }, [stores, storeSearch]);

  // ── Banner data by placement ──
  const heroBanners = useMemo(
    () => (homeFeed?.banners ?? []).filter((b) => b.placement === "HERO_CAROUSEL"),
    [homeFeed?.banners],
  );
  const midPageBanners = useMemo(
    () => (homeFeed?.banners ?? []).filter((b) => b.placement === "MID_PAGE"),
    [homeFeed?.banners],
  );
  const popupBanners = useMemo(
    () => (homeFeed?.banners ?? []).filter((b) => b.placement === "POPUP"),
    [homeFeed?.banners],
  );

  const [showPopup, setShowPopup] = useState(false);
  const popupShownRef = useRef(false);

  useEffect(() => {
    if (homeFeed && popupBanners.length > 0 && !popupShownRef.current) {
      popupShownRef.current = true;
      setShowPopup(true);
    }
  }, [homeFeed, popupBanners.length]);

  const [heroIndex, setHeroIndex] = useState(0);
  const heroRef = useRef<FlatList<Banner>>(null);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Auto-rotate hero carousel
  useEffect(() => {
    if (heroBanners.length <= 1) return;
    heroTimerRef.current = setInterval(() => {
      setHeroIndex((prev) => {
        const next = (prev + 1) % heroBanners.length;
        heroRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [heroBanners.length]);

  const handleBannerPress = useCallback((banner: Banner) => {
    switch (banner.actionType) {
      case "CATEGORY":
        if (banner.actionTarget) router.push({ pathname: "/category/[id]", params: { id: banner.actionTarget } });
        break;
      case "PRODUCT":
        if (banner.actionTarget) router.push({ pathname: "/product/[id]", params: { id: banner.actionTarget } });
        break;
      case "COLLECTION":
        // Navigate to search filtered by collection
        if (banner.actionTarget) router.push({ pathname: "/search", params: { collectionId: banner.actionTarget } } as any);
        break;
      case "SEARCH":
        if (banner.actionTarget) router.push({ pathname: "/search", params: { q: banner.actionTarget } } as any);
        break;
      case "URL":
        // External URLs — no-op on mobile for now
        break;
      case "NONE":
      default:
        break;
    }
  }, []);


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
    (products: StoreProduct[]) => <ProductList products={products} layout="rail" />,
    [],
  );

  if (storesLoading) return <HomeScreenSkeleton />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        {/* ── Fixed Header ── */}
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerRow}>
            <HomeHeaderLocation store={selectedStore} userArea={userArea} onPress={() => setShowStorePicker(true)} />
            <View style={styles.headerActions}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => router.push("/notifications")}>
                <Ionicons name="notifications-outline" size={20} color={colors.text} />
                {unreadCount > 0 && (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{unreadCount > 99 ? "99+" : unreadCount}</Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </View>

          <SearchBarButton />
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

          {/* ── Quick Access Chips (Mart Plus + Tomorrow's Basket) ── */}
          {selectedStore && (memberStatus?.isMember || hasSubscriptions) && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickChipsRow}
            >
              {memberStatus?.isMember && (
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => router.push("/membership")}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={["#fde68a", colors.accent]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.quickChipGradient}
                  >
                    <Ionicons name="diamond" size={14} color={colors.accentText} />
                    <Text style={[styles.quickChipText, styles.quickChipTextOnAccent]}>
                      {`Plus · ${memberStatus.membership?.daysLeft}d left`}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              {hasSubscriptions && (
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => router.push("/tomorrows-basket")}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={[colors.primary, colors.primaryLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.quickChipGradient}
                  >
                    <Ionicons name="basket" size={14} color="#fff" />
                    <Text style={styles.quickChipText}>Tomorrow's Basket</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
              {hasSubscriptions && (
                <TouchableOpacity
                  style={styles.quickChip}
                  onPress={() => router.push("/subscriptions")}
                  activeOpacity={0.8}
                >
                  <View style={styles.quickChipOutline}>
                    <Ionicons name="repeat" size={14} color={colors.primary} />
                    <Text style={styles.quickChipOutlineText}>Subscriptions</Text>
                  </View>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          {/* ── Hero Carousel ── */}
          {heroBanners.length > 0 && (
            <View style={styles.bannerSection}>
              <FlatList
                ref={heroRef}
                horizontal
                pagingEnabled
                data={heroBanners}
                keyExtractor={(item) => item.id}
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / (SCREEN_WIDTH - H_PADDING * 2));
                  setHeroIndex(idx);
                }}
                renderItem={({ item }) => (
                  <HeroBannerSlide banner={item} width={SCREEN_WIDTH - H_PADDING * 2} onPress={handleBannerPress} />
                )}
              />
              {heroBanners.length > 1 && (
                <View style={styles.heroDots}>
                  {heroBanners.map((_, i) => (
                    <View key={i} style={[styles.heroDot, heroIndex === i && styles.heroDotActive]} />
                  ))}
                </View>
              )}
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
                <TouchableOpacity onPress={() => router.push("/smart-reorder")} style={styles.seeAllBtn}>
                  <Text style={styles.seeAllText}>Smart reorder</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
              {renderProductList(homeFeed.buyAgain)}
            </View>
          )}

          {/* ── Shop by Category ── */}
          {homeFeed && homeFeed.departments.length > 0 && (
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
                {homeFeed.departments.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    title={getLocalizedName(cat)}
                    imageUrl={cat.imageUrl}
                    fallbackIcon={getCategoryIcon(cat.name)}
                    size={CATEGORY_TILE_SIZE}
                    onPress={() => handleCategoryPress(cat.id)}
                  />
                ))}
              </View>
            </View>
          )}

          {selectedStore && <HomeBrandRail storeId={selectedStore.id} />}

          {memberStatus && !memberStatus.isMember && <PlusPromoStrip />}

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

          {/* ── Mid-Page Banner ── */}
          {midPageBanners.length > 0 && (
            <View style={styles.midBannerSection}>
              {midPageBanners.map((banner) => (
                <HeroBannerSlide
                  key={banner.id}
                  banner={banner}
                  width={SCREEN_WIDTH - H_PADDING * 2}
                  height={152}
                  onPress={handleBannerPress}
                />
              ))}
            </View>
          )}

          {/* ── Time-Aware Spotlight ── */}
          {homeFeed && homeFeed.timeCategories.length > 0 && (
            <TimeSpotlight
              sections={homeFeed.timeCategories}
              period={homeFeed.timePeriod}
              renderProducts={renderProductList}
              onViewAll={handleCategoryPress}
            />
          )}

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

          {/* ── Shoppable Recipes ── */}
          {homeFeed && homeFeed.recipes && homeFeed.recipes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <View>
                  <Text style={styles.sectionTitle}>Shoppable Recipes</Text>
                  <Text style={styles.sectionSubtitle}>Cook a meal, add all ingredients</Text>
                </View>
                <TouchableOpacity
                  onPress={() => router.push("/recipes" as any)}
                  style={styles.seeAllBtn}
                >
                  <Text style={styles.seeAllText}>See All</Text>
                  <Ionicons name="chevron-forward" size={14} color={colors.primary} />
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 16 }}
              >
                {homeFeed.recipes.map((recipe) => (
                  <View key={recipe.id} style={{ marginRight: 12 }}>
                    <RecipeCard recipe={recipe} />
                  </View>
                ))}
              </ScrollView>
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

          {/* ── Store discovery (no store selected) ── */}
          {!selectedStore && <StoreDiscovery />}

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* ── Cart / Basket Floating Bar ── */}
        <FloatingCart aboveTabBar />


        {/* ── Popup Banner Modal ── */}
        {popupBanners.length > 0 && (
          <Modal visible={showPopup} transparent animationType="fade" onRequestClose={() => setShowPopup(false)}>
            <View style={styles.popupBackdrop}>
              <View style={styles.popupCard}>
                <TouchableOpacity
                  style={styles.popupClose}
                  onPress={() => setShowPopup(false)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={20} color="#64748b" />
                </TouchableOpacity>
                <TouchableOpacity
                  activeOpacity={popupBanners[0].actionType === "NONE" ? 1 : 0.9}
                  onPress={() => {
                    handleBannerPress(popupBanners[0]);
                    setShowPopup(false);
                  }}
                >
                  <Image source={{ uri: popupBanners[0].imageUrl }} style={styles.popupImage} resizeMode="cover" />
                </TouchableOpacity>
                <View style={styles.popupContent}>
                  <Text style={styles.popupTitle}>{popupBanners[0].title}</Text>
                  {popupBanners[0].subtitle && (
                    <Text style={styles.popupSubtitle}>{popupBanners[0].subtitle}</Text>
                  )}
                </View>
              </View>
            </View>
          </Modal>
        )}

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
    </ProductActionsProvider>
  );
}

// ── Speed-Dial FAB ──────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

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
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },


  // ── Scroll Content ──
  scrollContent: { paddingBottom: 8 },

  // ── Greeting ──
  // ── Quick Access Chips ──
  quickChipsRow: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
    paddingTop: 10,
    gap: 8,
  },
  quickChip: {
    borderRadius: 8,
    overflow: "hidden",
  },
  quickChipGradient: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderRadius: 8,
  },
  quickChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#fff",
  },
  quickChipTextOnAccent: {
    color: colors.accentText,
    fontWeight: "700",
  },
  quickChipOutline: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primary + "08",
  },
  quickChipOutlineText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },

  // ── Hero Carousel ──
  bannerSection: {
    paddingHorizontal: H_PADDING,
    paddingTop: 16,
  },
  heroDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#cbd5e1",
  },
  heroDotActive: {
    width: 18,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },

  // ── Category Strip ──
  // ── Mid-Page Banner ──
  midBannerSection: {
    paddingHorizontal: H_PADDING,
    marginTop: 20,
    gap: 12,
  },

  // ── Buy Again ──
  buyAgainSection: {
    marginTop: 16,
    backgroundColor: "#f0fdfa",
    paddingVertical: 18,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#ccfbf1",
  },
  buyAgainHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
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
    rowGap: 14,
  },

  // ── Product Lists ──
  productList: {
    paddingHorizontal: H_PADDING,
    paddingVertical: 4,
  },
  loadingRow: {
    flexDirection: "row",
    paddingHorizontal: H_PADDING,
    gap: 8,
    marginTop: 24,
  },
  productSkeleton: {
    width: FEATURED_CARD_WIDTH,
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  productSkeletonImage: {
    width: "100%",
    height: 80,
    backgroundColor: "#f1f5f9",
  },
  productSkeletonContent: {
    padding: 8,
    gap: 6,
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
  // ── Popup Banner Modal ──
  popupBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
  },
  popupCard: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    overflow: "hidden",
  },
  popupClose: {
    position: "absolute",
    top: 10,
    right: 10,
    zIndex: 10,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  popupImage: {
    width: "100%",
    height: 200,
  },
  popupContent: {
    padding: 20,
    alignItems: "center",
  },
  popupTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.text,
    textAlign: "center",
  },
  popupSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 18,
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
