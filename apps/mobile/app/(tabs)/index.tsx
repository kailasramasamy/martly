import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Dimensions,
  RefreshControl,
  Image,
} from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { RecipeCard } from "../../components/RecipeCard";
import { api } from "../../lib/api";
import { HomeBrandRail } from "../../components/HomeBrandRail";
import { useStore } from "../../lib/store-context";
import { useMembership } from "../../lib/membership-context";
import { useBasketMode } from "../../lib/basket-mode-context";
import { useLanguage } from "../../lib/language-context";
import { colors, spacing } from "../../constants/theme";
import { getCategoryIcon } from "../../constants/category-icons";
import { FEATURED_CARD_WIDTH } from "../../components/FeaturedProductCard";
import { ProductList } from "../../components/ProductList";
import { RecentlyViewedRail } from "../../components/home/RecentlyViewedRail";
import { ProductActionsProvider } from "../../lib/product-actions";
import { FloatingCart } from "../../components/FloatingCart";
import { HomeScreenSkeleton } from "../../components/SkeletonLoader";
import StoreDiscovery from "../../components/store-discovery/StoreDiscovery";
import { openBannerTarget } from "../../lib/banner-action";
import { recordBannerTap, recordBannerView } from "../../lib/banner-events";
import { useAuth } from "../../lib/auth-context";
import { HeroBannerSlide } from "../../components/HeroBannerSlide";
import { CategoryTile } from "../../components/CategoryTile";
import { TimeSpotlight } from "../../components/TimeSpotlight";
import { HomeHeader } from "../../components/home/HomeHeader";
import { FestiveHero } from "../../components/home/FestiveHero";
import { BannerCarousel } from "../../components/home/BannerCarousel";
import { PlusPromoStrip } from "../../components/PlusPromoStrip";
import type { StoreProduct, HomeFeed, Banner, FestiveTile } from "../../lib/types";
import { TabBottomDock } from "../../components/TabIcon";
import { useTabBarAutoHide } from "../../lib/tab-bar-visibility";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PADDING = 16;

// 4 tiles per row inside the padded section card
const CATEGORY_TILE_SIZE = Math.floor((SCREEN_WIDTH - H_PADDING * 2 - 32 - 12 * 3) / 4);

export default function HomeScreen() {
  const tabBarScroll = useTabBarAutoHide();
  // Height of the footer docked above the tab bar, so the list scrolls clear of it
  const [dockHeight, setDockHeight] = useState(0);
  const { selectedStore, loading: storesLoading, userArea, refreshStores } = useStore();
  const { isAuthenticated } = useAuth();
  const { isMember } = useMembership();
  const { isBasketMode } = useBasketMode();
  const { getLocalizedName } = useLanguage();

  const [homeFeed, setHomeFeed] = useState<HomeFeed | null>(null);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [memberStatus, setMemberStatus] = useState<{ isMember: boolean; membership: { planName: string; endDate: string; daysLeft: number } | null } | null>(null);
  const [hasSubscriptions, setHasSubscriptions] = useState(false);

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
    // Membership and subscriptions belong to an account; guests have neither
    if (!isAuthenticated) {
      setMemberStatus(null);
      setHasSubscriptions(false);
      return;
    }
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
  }, [selectedStore, isAuthenticated]);

  useEffect(() => {
    fetchHomeFeed();
  }, [fetchHomeFeed]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedStore) fetchHomeFeed();
    else await refreshStores();
    setTimeout(() => setRefreshing(false), 600);
  }, [fetchHomeFeed, refreshStores, selectedStore]);




  // ── Banner data by placement ──
  // A live festival's hero takes the top of the screen; the banner carousel moves below the categories
  const festiveHero = homeFeed?.festiveHero ?? null;
  const headerTint = festiveHero && !festiveHero.theme.dark ? festiveHero.theme.background : null;
  const heroBanners = useMemo(
    () => (homeFeed?.banners ?? []).filter(
      (b) => b.placement === "HERO_CAROUSEL" && !(b.actionType === "COLLECTION" && b.actionTarget === festiveHero?.id),
    ),
    [festiveHero, homeFeed?.banners],
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
      recordBannerView(selectedStore?.id, popupBanners[0].id);
    }
  }, [homeFeed, popupBanners, selectedStore?.id]);

  const handleFestiveTile = useCallback((tile: FestiveTile) => {
    if (festiveHero) router.push({ pathname: "/festival/[id]", params: { id: festiveHero.id, tile: tile.id } });
  }, [festiveHero]);

  const handleBannerPress = useCallback((banner: Banner) => openBannerTarget(banner), []);


  const handleCategoryPress = useCallback(
    (categoryId: string) => {
      router.push({ pathname: "/category/[id]", params: { id: categoryId } });
    },
    [],
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
        <HomeHeader store={selectedStore} userArea={userArea} onPickStore={() => router.push("/choose-store")} tint={headerTint} collapsed={tabBarScroll.headerCollapsed} />

        <ScrollView keyboardDismissMode="on-drag" {...tabBarScroll.scrollProps}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={tabBarScroll.contentStyle(styles.scrollContent, dockHeight)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        >

          {festiveHero && <FestiveHero hero={festiveHero} onTile={handleFestiveTile} />}

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

          {!festiveHero && heroBanners.length > 0 && <BannerCarousel banners={heroBanners} onPress={handleBannerPress} />}

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

          {selectedStore && <RecentlyViewedRail storeId={selectedStore.id} />}

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

          {festiveHero && heroBanners.length > 0 && <BannerCarousel banners={heroBanners} onPress={handleBannerPress} />}

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
        <TabBottomDock onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}>
          <FloatingCart aboveTabBar />
        </TabBottomDock>


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
                    recordBannerTap(selectedStore?.id, popupBanners[0].id);
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

      </View>
    </ProductActionsProvider>
  );
}

// ── Speed-Dial FAB ──────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },

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

});
