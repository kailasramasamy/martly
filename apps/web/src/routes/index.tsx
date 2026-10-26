import { useState } from "react"
import { createFileRoute, useLoaderData } from "@tanstack/react-router"
import type { WebHome } from "@martly/shared/types"
import { getHomeSections } from "~/lib/api"
import { faqs } from "~/lib/content"
import { homeJsonLd, pageHead } from "~/lib/seo"
import { ShopLayout } from "~/components/shop-layout"
import { HomeSections } from "~/components/home"
import { StoresSection } from "~/components/stores-section"
import { AppBand } from "~/components/bands"
import { FaqSection } from "~/components/faq"

export const Route = createFileRoute("/")({
  // Two pages of sections come with the HTML, so the hero and the first rows are there for search engines and first paint
  loader: async ({ parentMatchPromise }) => {
    const first = await getHomeSections({ data: {} })
    const second = first.nextCursor ? await getHomeSections({ data: { cursor: first.nextCursor } }) : null
    // The root route loads the live towns and departments
    const home = (await parentMatchPromise).loaderData as WebHome
    return {
      store: first.store,
      sections: [...first.sections, ...(second?.sections ?? [])],
      cursor: (second ?? first).nextCursor,
      jsonLd: homeJsonLd(home, faqs(home.towns.map((t) => t.name))),
    }
  },
  head: ({ loaderData }) => {
    const town = loaderData?.store.town.name ?? "your town"
    return pageHead({
      title: `Order groceries online in ${town} | Martly`,
      description: `Shop groceries, vegetables, dairy and household essentials from ${town}'s own stores on Martly. The store packs and delivers; pay by UPI, card or cash.`,
      path: "/",
      jsonLd: loaderData?.jsonLd,
    })
  },
  component: HomePage,
})

function HomePage() {
  const { store, sections, cursor } = Route.useLoaderData()
  const { towns } = useLoaderData({ from: "__root__" })
  const [townSlug, setTownSlug] = useState(store.town.slug)
  const selected = towns.find((t) => t.slug === townSlug)
  return (
    <ShopLayout store={store}>
      <h1 className="mx-auto max-w-7xl px-4 pt-3 text-[13px] font-bold text-muted sm:px-6">
        {store.name}, {store.town.name}: groceries online
      </h1>
      <HomeSections key={store.id} sections={sections} cursor={cursor} />
      <StoresSection towns={towns} selected={selected} onSelect={setTownSlug} />
      <AppBand />
      <FaqSection items={faqs(towns.map((t) => t.name))} />
    </ShopLayout>
  )
}
