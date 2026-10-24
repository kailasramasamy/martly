import type { ComponentType } from "react";
import type { AdProductKind } from "@martly/shared/constants";
import { HomeCarouselMockup, HomePosterMockup, HomePromotionMockup } from "./HomeMockups";
import { CategoryFeaturedMockup, CategorySponsoredMockup, CategoryTakeoverMockup, DiscountGridMockup } from "./ListingMockups";
import { SearchFeaturedMockup, SearchSponsoredMockup, SearchSuggestionsMockup } from "./SearchMockups";
import { TabSlotMockup } from "./TabSlotMockup";

export interface PlacementMockup { render: ComponentType; caption: string }
export interface PlacementPreview { title: string; mockups: PlacementMockup[] }

const CAROUSEL: PlacementMockup = { render: HomeCarouselMockup, caption: "Leads the Home carousel, just below the category directory." };

/** What a brand package buys and where the shopper sees it; null when nothing is shown */
export function previewFor(kind: AdProductKind, placement: string | null): PlacementPreview | null {
  switch (kind) {
    case "BRAND_BANNER":
      return placement === "HOME_POSTER"
        ? { title: "Brand poster", mockups: [{ render: HomePosterMockup, caption: "A tall poster in the Brand posters rail on Home." }] }
        : { title: "Brand banner", mockups: [CAROUSEL] };
    case "BRAND_PROMOTION":
      return {
        title: "Brand promotion",
        mockups: [
          { render: HomePromotionMockup, caption: "A carousel slide and a shoppable offer card on Home." },
          { render: DiscountGridMockup, caption: "The discount shows on the brand's products everywhere." },
        ],
      };
    case "BRAND_TAKEOVER":
      return { title: "Category takeover", mockups: [{ render: CategoryTakeoverMockup, caption: "The banner at the top of one category page." }] };
    case "BRAND_SPONSORED_PRODUCT":
      return {
        title: "Sponsored product",
        mockups: [
          { render: SearchSponsoredMockup, caption: "First result in search, marked Ad. Also first pick in My list and Speak orders." },
          { render: CategorySponsoredMockup, caption: "Second in its category listing, marked Ad." },
          { render: SearchSuggestionsMockup, caption: "A sponsored row in search suggestions, tagged Ad." },
        ],
      };
    case "BRAND_FEATURE":
      return {
        title: "Featured brand",
        mockups: [
          { render: SearchFeaturedMockup, caption: "The brand's products in its category rank ahead, marked Featured." },
          { render: CategoryFeaturedMockup, caption: "Featured products take slots 1, 4 and 7 in the category listing." },
        ],
      };
    case "BRAND_TAB_SLOT":
      return { title: "Brand tab slot", mockups: [{ render: TabSlotMockup, caption: "The brand's logo in the app's bottom bar, opening its brand page." }] };
    case "BRAND_CPM":
      return { title: "Brand views", mockups: [{ render: HomeCarouselMockup, caption: "Home carousel, billed per 1,000 views." }] };
    default:
      return null;
  }
}
