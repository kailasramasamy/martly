import { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  FlatList,
  StyleSheet,
  RefreshControl,
  Platform,
  type LayoutChangeEvent,
  type ListRenderItem,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ViewToken,
} from "react-native";
import { Loader } from "../../components/Loader";
import { router } from "expo-router";
import { useStore } from "../../lib/store-context";
import { useAuth } from "../../lib/auth-context";
import { colors } from "../../constants/theme";
import { ProductActionsProvider } from "../../lib/product-actions";
import { FloatingCart } from "../../components/FloatingCart";
import { HomeScreenSkeleton } from "../../components/SkeletonLoader";
import { HomeHeader } from "../../components/home/HomeHeader";
import { HomeCredits } from "../../components/credits/HomeCredits";
import { HomeListFooter } from "../../components/home/HomeListFooter";
import { BackToTopPill, useBackToTop } from "../../components/home/BackToTopPill";
import { FreeDeliveryBar } from "../../components/home/FreeDeliveryBar";
import { useMemberStatus } from "../../components/home/use-member-status";
import { HomeSectionView } from "../../components/home/sections";
import { HomeSectionProvider, type HomeSectionEnv } from "../../components/home/sections/context";
import { useLightStatusBar } from "../../lib/use-light-status-bar";
import { useHomeSections, type MobileHomeSection } from "../../lib/use-home-sections";
import { heroHeaderTheme } from "../../components/home/hero-cards/hero-theme";
import { withoutHeroDuplicates } from "@martly/shared/home";
import { refreshBrandSpotlight } from "../../lib/use-brand-spotlight";
import type { HomeTheme } from "@martly/shared/types";
import { TabBottomDock } from "../../components/TabIcon";
import { recordSectionView } from "../../lib/home-events";
import { useTabScroll } from "../../lib/tab-bar";

const THEMED_LEADS = new Set<string>(["FESTIVE_HERO", "HERO_CARDS"]);
// Welcome credit sits under the lead section: the lead hero lays itself out under the floating header
const renderSection: ListRenderItem<MobileHomeSection> = ({ item, index }) => (
  index === 0 ? <><HomeSectionView section={item} /><HomeCredits /></> : <HomeSectionView section={item} />
);
const keyOf = (section: MobileHomeSection) => section.id;

/** The header's height as laid out now, and fully expanded (the festive art clears the expanded one) */
function useHeaderHeights(collapsed: boolean) {
  const [height, setHeight] = useState(0);
  const [expanded, setExpanded] = useState(0);
  const onLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setHeight(h);
    if (!collapsed) setExpanded(h);
  }, [collapsed]);
  return { height, expanded, onLayout };
}

/** One scroll handler for both the tab bar's auto-hide and the back-to-top pill */
function useHomeScroll() {
  const tabBarScroll = useTabScroll();
  const backToTop = useBackToTop();
  const listRef = useRef<FlatList<MobileHomeSection>>(null);
  const tabOnScroll = tabBarScroll.scrollProps.onScroll;
  const backOnScroll = backToTop.onScroll;
  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    tabOnScroll(e);
    backOnScroll(e);
  }, [tabOnScroll, backOnScroll]);
  const scrollToTop = useCallback(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }), []);
  return { tabBarScroll, listRef, onScroll, scrollToTop, showBackToTop: backToTop.visible };
}

/** Home's data: the section pages plus the shopper's membership, with one pull-to-refresh for both */
function useHomeData() {
  const { selectedStore, refreshStores } = useStore();
  const { isAuthenticated, isLoading, user } = useAuth();
  const loaded = useHomeSections(selectedStore?.id, isLoading ? undefined : user?.id ?? null);
  const sections = useMemo(() => withoutHeroDuplicates(loaded.sections), [loaded.sections]);
  const home = { ...loaded, sections };
  const member = useMemberStatus(selectedStore, isAuthenticated);
  const [refreshing, setRefreshing] = useState(false);
  const { reload } = home;
  const refreshMember = member.refresh;

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedStore) {
      refreshMember();
      refreshBrandSpotlight();
      await reload();
    } else {
      await refreshStores();
    }
    setRefreshing(false);
  }, [selectedStore, refreshMember, reload, refreshStores]);

  return { home, member, refreshing, onRefresh };
}

/** What every section can read: the store, the shopper's membership and how the festive top is laid out */
function useSectionEnv(data: ReturnType<typeof useHomeData>, expandedHeader: number, heroInView: boolean) {
  const { selectedStore } = useStore();
  const { sections, chrome } = data.home;
  // A festival hero or the hero cards leading the page run their wash up behind the header, which floats over it
  // see-through and takes the colours of the slide or card in view
  const [slideTheme, setSlideTheme] = useState<HomeTheme | null>(null);
  const lead = sections[0];
  const leadTheme = lead?.type === "HERO_CARDS" ? heroHeaderTheme(lead.cards[0].theme) : chrome?.headerTheme ?? null;
  const festive = lead && THEMED_LEADS.has(lead.type) ? slideTheme ?? leadTheme : null;
  const festiveHeroIds = useMemo(() => {
    const hero = sections.find((s) => s.type === "FESTIVE_HERO");
    return hero && "data" in hero ? (hero.data.heroes as { id: string }[]).map((h) => h.id) : [];
  }, [sections]);
  const { memberStatus, hasSubscriptions } = data.member;

  const env = useMemo<HomeSectionEnv | null>(() => selectedStore && ({
    store: selectedStore,
    memberStatus,
    hasSubscriptions,
    festiveHeroIds,
    onFestiveTheme: setSlideTheme,
    leadId: lead?.id ?? null,
    festiveTheme: festive,
    // Only the festive hero's colour carries into the row under it; the hero cards' wash fades into the page
    afterHeroId: festive && lead?.type === "FESTIVE_HERO" ? sections[1]?.id ?? null : null,
    heroInView,
    backdrop: festive && expandedHeader ? { top: expandedHeader } : null,
  }), [selectedStore, memberStatus, hasSubscriptions, festiveHeroIds, festive, sections, lead, expandedHeader, heroInView]);
  return { env, festive };
}

interface ListProps {
  data: ReturnType<typeof useHomeData>;
  scroll: ReturnType<typeof useHomeScroll>;
  dockHeight: number;
  /** Festive title colour for the pull-to-refresh spinner, and the header it has to clear */
  festiveInk: string | null;
  headerOffset: number;
  /** False while there is no store to render against, e.g. the render where it clears before the stale sections do */
  ready: boolean;
  onHeroInView: (inView: boolean) => void;
}

const HERO_VIEWABILITY = { itemVisiblePercentThreshold: 30 };

function SectionList({ data, scroll, dockHeight, festiveInk, headerOffset, ready, onHeroInView }: ListProps) {
  const { home, refreshing, onRefresh } = data;
  const { tabBarScroll } = scroll;
  const storeId = home.storeId;
  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken<MobileHomeSection>[] }) => {
    onHeroInView(viewableItems.some((v) => THEMED_LEADS.has(v.item.type)));
    for (const v of viewableItems) recordSectionView(storeId, { sectionId: v.item.id, sectionType: v.item.type });
  }, [onHeroInView, storeId]);
  return (
    <FlatList
      ref={scroll.listRef}
      data={ready ? home.sections : []}
      keyExtractor={keyOf}
      renderItem={renderSection}
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
      {...tabBarScroll.scrollProps}
      onScroll={scroll.onScroll}
      viewabilityConfig={HERO_VIEWABILITY}
      onViewableItemsChanged={onViewableItemsChanged}
      contentContainerStyle={tabBarScroll.contentStyle(styles.scrollContent, dockHeight)}
      onEndReached={home.loadMore}
      onEndReachedThreshold={1.5}
      windowSize={7}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      removeClippedSubviews={Platform.OS === "android"}
      ListFooterComponent={
        <HomeListFooter
          hasStore={Boolean(home.storeId)}
          loading={home.loading && home.sections.length === 0}
          loadingMore={home.loadingMore}
          reachedEnd={home.reachedEnd && home.sections.length > 0}
        />
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={festiveInk && Platform.OS === "ios" ? "transparent" : festiveInk ?? colors.primary}
          colors={[colors.primary]}
          progressViewOffset={festiveInk ? headerOffset : undefined}
        />
      }
    />
  );
}

export default function HomeScreen() {
  const { selectedStore, loading: storesLoading, userArea, deliversToYou } = useStore();
  const data = useHomeData();
  const scroll = useHomeScroll();
  const header = useHeaderHeights(scroll.tabBarScroll.headerCollapsed);
  const [heroInView, setHeroInView] = useState(true);
  const { env, festive } = useSectionEnv(data, header.expanded, heroInView);
  useLightStatusBar(Boolean(festive?.dark));
  // Height of the footer docked above the tab bar, so the list scrolls clear of it
  const [dockHeight, setDockHeight] = useState(0);
  const { chrome } = data.home;

  if (storesLoading) return <HomeScreenSkeleton />;

  return (
    <ProductActionsProvider store={selectedStore ?? null}>
      <View style={styles.container}>
        <HomeHeader
          store={selectedStore}
          userArea={userArea}
          pickupOnly={deliversToYou === false}
          onPickStore={() => router.push("/choose-store")}
          festive={festive}
          collapsed={scroll.tabBarScroll.headerCollapsed}
          onLayout={header.onLayout}
          searchHints={chrome?.searchHints}
          searchHintTranslations={chrome?.searchHintTranslations}
        />
        <HomeSectionProvider value={env}>
          <SectionList data={data} scroll={scroll} dockHeight={dockHeight} festiveInk={festive?.title ?? null} headerOffset={header.expanded} ready={env !== null} onHeroInView={setHeroInView} />
        </HomeSectionProvider>
        {/* iOS draws the pull-to-refresh spinner under the floating festive header (its offset is Android-only), so show one below it */}
        {festive && Platform.OS === "ios" && data.refreshing ? (
          <Loader color={festive.title} style={[styles.festiveRefresh, { top: header.expanded + 12 }]} />
        ) : null}
        <BackToTopPill visible={scroll.showBackToTop} top={header.height + 8} onPress={scroll.scrollToTop} />
        <TabBottomDock onLayout={(e) => setDockHeight(e.nativeEvent.layout.height)}>
          <FreeDeliveryBar threshold={chrome?.freeDeliveryThreshold ?? null} storeId={selectedStore?.id} />
          <FloatingCart aboveTabBar />
        </TabBottomDock>
      </View>
    </ProductActionsProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  scrollContent: { paddingBottom: 8 },
  festiveRefresh: { position: "absolute", alignSelf: "center", zIndex: 11 },
});
