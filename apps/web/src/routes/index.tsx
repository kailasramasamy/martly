import { createFileRoute } from "@tanstack/react-router"
import type { WebHome } from "@martly/shared/types"
import { faqs } from "~/lib/content"
import { homeJsonLd, pageHead } from "~/lib/seo"
import { loadHomePage } from "~/lib/home-page"
import { HomePage } from "~/components/home/home-page"
import { ShopLayout } from "~/components/shop-layout"
import { AppBand, OwnersBand } from "~/components/bands"

export const Route = createFileRoute("/")({
  loader: async ({ parentMatchPromise }) => {
    const page = await loadHomePage()
    // The root route loads the live towns and departments
    const home = (await parentMatchPromise).loaderData as WebHome
    return { page, jsonLd: homeJsonLd(home, faqs(home.towns.map((t) => t.name))) }
  },
  head: ({ loaderData }) => {
    const town = loaderData?.page?.store.town.name ?? "your town"
    return pageHead({
      title: `Order groceries online in ${town} | Martly`,
      description: `Shop groceries, vegetables, dairy and household essentials from ${town}'s own stores on Martly. The store packs and delivers; pay by UPI, card or cash.`,
      path: "/",
      jsonLd: loaderData?.jsonLd,
    })
  },
  component: () => {
    const { page } = Route.useLoaderData()
    return page ? <HomePage page={page} /> : <NoStoresYet />
  },
})

/** No store is on martlyshop.in right now: the app and the owner pitch, instead of an empty shop */
function NoStoresYet() {
  return (
    <ShopLayout store={null} departments={false}>
      <section className="mx-auto max-w-3xl px-4 pt-16 text-center sm:px-6 sm:pt-24">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Shop your local stores on the Martly app</h1>
        <p className="mt-4 text-lg text-muted">Order groceries from stores near you, in Tamil or English. The store packs and delivers.</p>
      </section>
      <AppBand />
      <OwnersBand />
    </ShopLayout>
  )
}
