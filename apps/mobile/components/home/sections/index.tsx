import { memo, type ComponentType } from "react";
import type { HomeSectionType } from "@martly/shared/constants";
import type { CampaignCardSection as CampaignCard, ProductRowSection as ProductRow, SystemSection } from "@martly/shared/types";
import type { MobileHomeSection } from "../../../lib/use-home-sections";
import type { StoreProduct } from "../../../lib/types";
import { CampaignCardSection } from "./campaign/CampaignCardSection";
import { ProductRowSection } from "./ProductRowSection";
import { HeroBannersSection, MidBannersSection } from "./system/BannerSections";
import { BuyAgainSection } from "./system/BuyAgainSection";
import { BrandRailSection, PlusPromoSection, RecentlyViewedSection, TimePicksSection } from "./system/ClientSections";
import { DealsSection } from "./system/DealsSection";
import { DepartmentGridSection } from "./system/DepartmentGridSection";
import { FestiveHeroSection } from "./system/FestiveHeroSection";
import { MemberChipsSection } from "./system/MemberChipsSection";
import { RecipesSection } from "./system/RecipesSection";

type SectionOf<K extends HomeSectionType> =
  K extends "PRODUCT_ROW" ? ProductRow<StoreProduct>
  : K extends "CAMPAIGN_CARD" ? CampaignCard<StoreProduct>
  : SystemSection;

type Registry = { [K in HomeSectionType]?: ComponentType<{ section: SectionOf<K> }> };

/** How each section type draws; types this build doesn't know yet (newer layouts on older apps) draw nothing */
const SECTIONS: Registry = {
  FESTIVE_HERO: FestiveHeroSection,
  MEMBER_CHIPS: MemberChipsSection,
  HERO_BANNERS: HeroBannersSection,
  BUY_AGAIN: BuyAgainSection,
  RECENTLY_VIEWED: RecentlyViewedSection,
  DEPARTMENT_GRID: DepartmentGridSection,
  BRAND_RAIL: BrandRailSection,
  PLUS_PROMO: PlusPromoSection,
  MID_BANNERS: MidBannersSection,
  TIME_PICKS: TimePicksSection,
  DEALS: DealsSection,
  RECIPES: RecipesSection,
  PRODUCT_ROW: ProductRowSection,
  CAMPAIGN_CARD: CampaignCardSection,
};

export const HomeSectionView = memo(function HomeSectionView({ section }: { section: MobileHomeSection }) {
  const Section = SECTIONS[section.type] as ComponentType<{ section: MobileHomeSection }> | undefined;
  return Section ? <Section section={section} /> : null;
});
