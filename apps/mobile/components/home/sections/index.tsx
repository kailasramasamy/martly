import { memo, type ComponentType } from "react";
import type { HomeSectionType } from "@martly/shared/constants";
import type {
  BestsellerCategoriesSection as BestsellerCategories, BrandCardSection as BrandCard, BuyGetDealsSection as BuyGetDeals, CampaignCardSection as CampaignCard, CategoryDirectorySection as CategoryDirectory,
  HeroCardsSection as HeroCards,
  PriceBandDealsSection as PriceBandDeals, ProductRowSection as ProductRow, StoreSpecialsSection as StoreSpecials, SystemSection, TabbedRowSection as TabbedRow, ThemeBandSection as ThemeBand,
  TileGridSection as TileGrid,
} from "@martly/shared/types";
import type { MobileHomeSection } from "../../../lib/use-home-sections";
import type { StoreProduct } from "../../../lib/types";
import { BestsellerCategoriesSection } from "./BestsellerCategoriesSection";
import { BrandCardSection } from "./BrandCardSection";
import { BuyGetDealsSection } from "./BuyGetDealsSection";
import { CampaignCardSection } from "./campaign/CampaignCardSection";
import { CategoryDirectorySection } from "./CategoryDirectorySection";
import { ExploreGridSection } from "./ExploreGridSection";
import { PriceBandDealsSection } from "./PriceBandDealsSection";
import { ProductRowSection } from "./ProductRowSection";
import { StoreGridSection } from "./StoreGridSection";
import { StoreSpecialsSection } from "./StoreSpecialsSection";
import { TabbedRowSection } from "./TabbedRowSection";
import { ThemeBandSection } from "./ThemeBandSection";
import { HeroBannersSection } from "./system/BannerSections";
import { BrandPostersSection } from "./system/BrandPostersSection";
import { BuyAgainSection } from "./system/BuyAgainSection";
import { BrandRailSection, PlusPromoSection, RecentlyViewedSection, TimePicksSection } from "./system/ClientSections";
import { DealsSection } from "./system/DealsSection";
import { DepartmentGridSection } from "./system/DepartmentGridSection";
import { FestiveHeroSection } from "./system/FestiveHeroSection";
import { MemberChipsSection } from "./system/MemberChipsSection";
import { MonthlyListSection } from "./system/MonthlyListSection";
import { OffersSection } from "./system/OffersSection";
import { RecipesSection } from "./system/RecipesSection";
import { StoreWalkSection } from "./system/StoreWalkSection";
import { HeroCardsSection } from "../hero-cards/HeroCardsSection";

type SectionOf<K extends HomeSectionType> =
  K extends "PRODUCT_ROW" ? ProductRow<StoreProduct>
  : K extends "CAMPAIGN_CARD" ? CampaignCard<StoreProduct>
  : K extends "TABBED_ROW" ? TabbedRow<StoreProduct>
  : K extends "PRICE_BAND_DEALS" ? PriceBandDeals<StoreProduct>
  : K extends "BRAND_CARD" ? BrandCard<StoreProduct>
  : K extends "CATEGORY_DIRECTORY" ? CategoryDirectory
  : K extends "BESTSELLER_CATEGORIES" ? BestsellerCategories
  : K extends "THEME_BAND" ? ThemeBand
  : K extends "STORE_SPECIALS" ? StoreSpecials<StoreProduct>
  : K extends "BUY_GET_DEALS" ? BuyGetDeals<StoreProduct>
  : K extends "HERO_CARDS" ? HeroCards<StoreProduct>
  : K extends "EXPLORE_GRID" | "STORE_GRID" ? TileGrid
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
  TIME_PICKS: TimePicksSection,
  DEALS: DealsSection,
  RECIPES: RecipesSection,
  PRODUCT_ROW: ProductRowSection,
  CAMPAIGN_CARD: CampaignCardSection,
  TABBED_ROW: TabbedRowSection,
  PRICE_BAND_DEALS: PriceBandDealsSection,
  BRAND_CARD: BrandCardSection,
  CATEGORY_DIRECTORY: CategoryDirectorySection,
  BESTSELLER_CATEGORIES: BestsellerCategoriesSection,
  THEME_BAND: ThemeBandSection,
  STORE_SPECIALS: StoreSpecialsSection,
  BUY_GET_DEALS: BuyGetDealsSection,
  HERO_CARDS: HeroCardsSection,
  EXPLORE_GRID: ExploreGridSection,
  STORE_GRID: StoreGridSection,
  OFFERS: OffersSection,
  BRAND_POSTERS: BrandPostersSection,
  STORE_WALK: StoreWalkSection,
  MONTHLY_LIST: MonthlyListSection,
};

export const HomeSectionView = memo(function HomeSectionView({ section }: { section: MobileHomeSection }) {
  const Section = SECTIONS[section.type] as ComponentType<{ section: MobileHomeSection }> | undefined;
  return Section ? <Section section={section} /> : null;
});
