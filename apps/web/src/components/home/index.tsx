import { useEffect, useRef, useState } from "react"
import type { WebHomeSection } from "@martly/shared/types"
import { getHomeSections } from "~/lib/api"
import { Banners, FestiveHero } from "./banners"
import { CampaignCard, StoreSpecials } from "./campaign"
import { PriceBandDeals } from "./deals"
import { HeroCards } from "./hero-cards"
import { BrandCard, OfferRow, ProductRow, TabbedRow, TimePicks } from "./product-rows"
import { BestsellerCategories, BrandRail, CategoryDirectory, DepartmentGrid, ThemeBand, TileGrid } from "./tiles"

function HomeSection({ section }: { section: WebHomeSection }) {
  switch (section.type) {
    case "HERO_CARDS": return <HeroCards section={section} />
    case "FESTIVE_HERO": return <FestiveHero section={section} />
    case "HERO_BANNERS":
    case "BRAND_POSTERS": return <Banners section={section} />
    case "DEPARTMENT_GRID": return <DepartmentGrid section={section} />
    case "CATEGORY_DIRECTORY": return <CategoryDirectory section={section} />
    case "BESTSELLER_CATEGORIES": return <BestsellerCategories section={section} />
    case "PRODUCT_ROW": return <ProductRow section={section} />
    case "TABBED_ROW": return <TabbedRow section={section} />
    case "THEME_BAND": return <ThemeBand section={section} />
    case "PRICE_BAND_DEALS": return <PriceBandDeals section={section} />
    case "EXPLORE_GRID":
    case "STORE_GRID": return <TileGrid section={section} />
    case "BRAND_RAIL": return <BrandRail section={section} />
    case "BRAND_CARD": return <BrandCard section={section} />
    case "TIME_PICKS": return <TimePicks section={section} />
    case "BUY_GET_DEALS":
    case "DEALS": return <OfferRow section={section} />
    case "CAMPAIGN_CARD": return <CampaignCard section={section} />
    case "STORE_SPECIALS": return <StoreSpecials section={section} />
  }
}

/** Starts loading the next page this far before the shopper reaches the end */
const AHEAD = "1200px"

/**
 * The app's Home, section by section: the first pages come with the HTML (for search engines and a fast first paint),
 * the rest load as the shopper scrolls, as the app's list does
 */
export function HomeSections({ sections, cursor }: { sections: WebHomeSection[]; cursor: string | null }) {
  const [loaded, setLoaded] = useState({ sections, cursor })
  const [failed, setFailed] = useState(false)
  const sentinel = useRef<HTMLDivElement>(null)
  const busy = useRef(false)

  useEffect(() => {
    const el = sentinel.current
    if (!el || !loaded.cursor || failed) return
    const observer = new IntersectionObserver(async ([entry]) => {
      if (!entry.isIntersecting || busy.current) return
      busy.current = true
      const next = await getHomeSections({ data: { cursor: loaded.cursor! } }).catch(() => null)
      busy.current = false
      if (!next) return setFailed(true)
      setLoaded((all) => ({ sections: [...all.sections, ...next.sections], cursor: next.nextCursor }))
    }, { rootMargin: AHEAD })
    observer.observe(el)
    return () => observer.disconnect()
  }, [loaded.cursor, failed])

  return (
    <>
      {loaded.sections.map((s) => <HomeSection key={s.id} section={s} />)}
      {loaded.cursor && !failed && <div ref={sentinel} aria-hidden="true" className="h-px" />}
    </>
  )
}
