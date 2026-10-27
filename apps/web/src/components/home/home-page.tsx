import { useState } from "react"
import { useLoaderData } from "@tanstack/react-router"
import type { HomePageData } from "~/lib/home-page"
import { faqs } from "~/lib/content"
import { ShopLayout } from "~/components/shop-layout"
import { HomeSections } from "~/components/home"
import { StoreBanner } from "~/components/home/store-banner"
import { HeroCarousel } from "~/components/home/hero-carousel"
import { StoresSection } from "~/components/stores-section"
import { AppBand } from "~/components/bands"
import { FaqSection } from "~/components/faq"

/** The shop: Home at `/` and at each store's own address */
export function HomePage({ page }: { page: HomePageData }) {
  const { store, profile, covers, sections, cursor } = page
  const { towns } = useLoaderData({ from: "__root__" })
  const [townSlug, setTownSlug] = useState(store.town.slug)
  const selected = towns.find((t) => t.slug === townSlug)
  return (
    <ShopLayout store={store}>
      <StoreBanner store={store} profile={profile} />
      {covers.length > 0 && <HeroCarousel banners={covers} storeId={store.id} />}
      <HomeSections key={store.id} sections={sections} cursor={cursor} />
      <StoresSection towns={towns} selected={selected} onSelect={setTownSlug} />
      <AppBand />
      <FaqSection items={faqs(towns.map((t) => t.name))} />
    </ShopLayout>
  )
}
