import { memo, useCallback } from "react";
import { router } from "expo-router";
import type { SystemSection } from "@martly/shared/types";
import type { StoreProduct, TimeCategorySection } from "../../../../lib/types";
import { HomeBrandRail } from "../../../HomeBrandRail";
import { PlusPromoStrip } from "../../../PlusPromoStrip";
import { ProductList } from "../../../ProductList";
import { TimeSpotlight } from "../../../TimeSpotlight";
import { RecentlyViewedRail } from "../../RecentlyViewedRail";
import { useHomeSectionEnv } from "../context";

// Blocks that load their own data (or have no data) and the time-of-day picks

export const RecentlyViewedSection = memo(function RecentlyViewedSection() {
  const { store } = useHomeSectionEnv();
  return <RecentlyViewedRail storeId={store.id} />;
});

export const BrandRailSection = memo(function BrandRailSection() {
  const { store } = useHomeSectionEnv();
  return <HomeBrandRail storeId={store.id} />;
});

/** The membership upsell, for signed-in shoppers who aren't members (members get their chip at the top instead) */
export const PlusPromoSection = memo(function PlusPromoSection() {
  const { memberStatus } = useHomeSectionEnv();
  return memberStatus && !memberStatus.isMember ? <PlusPromoStrip /> : null;
});

const renderRail = (products: StoreProduct[]) => <ProductList products={products} layout="rail" />;

export const TimePicksSection = memo(function TimePicksSection({ section }: { section: SystemSection }) {
  const onViewAll = useCallback((id: string) => router.push({ pathname: "/category/[id]", params: { id } }), []);
  return (
    <TimeSpotlight
      sections={section.data.categories as TimeCategorySection[]}
      period={section.data.period as string}
      renderProducts={renderRail}
      onViewAll={onViewAll}
    />
  );
});
