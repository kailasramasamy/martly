import { createFileRoute } from "@tanstack/react-router"
import type { WebHome } from "@martly/shared/types"
import { faqs } from "~/lib/content"
import { homeJsonLd, pageHead } from "~/lib/seo"
import { loadHomePage } from "~/lib/home-page"
import { HomePage } from "~/components/home/home-page"

export const Route = createFileRoute("/")({
  loader: async ({ parentMatchPromise }) => {
    const page = await loadHomePage()
    // The root route loads the live towns and departments
    const home = (await parentMatchPromise).loaderData as WebHome
    return { page, jsonLd: homeJsonLd(home, faqs(home.towns.map((t) => t.name))) }
  },
  head: ({ loaderData }) => {
    const town = loaderData?.page.store.town.name ?? "your town"
    return pageHead({
      title: `Order groceries online in ${town} | Martly`,
      description: `Shop groceries, vegetables, dairy and household essentials from ${town}'s own stores on Martly. The store packs and delivers; pay by UPI, card or cash.`,
      path: "/",
      jsonLd: loaderData?.jsonLd,
    })
  },
  component: () => <HomePage page={Route.useLoaderData().page} />,
})
