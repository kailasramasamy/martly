import { createFileRoute } from "@tanstack/react-router"
import { FoodType, SearchSortBy } from "@martly/shared/constants"
import { getSearchLanding, searchShop, type SearchParams } from "~/lib/api"
import { pageHead } from "~/lib/seo"
import { ShopLayout } from "~/components/shop-layout"
import { textParam } from "~/components/list-page"
import { SearchLandingView } from "~/components/search/landing"
import { SearchResults } from "~/components/search/results"

const oneOf = <T extends string>(values: Record<string, T>, value: unknown) =>
  (Object.values(values) as unknown[]).includes(value) ? (value as T) : undefined
// The router runs this on what it read from the URL ("1") and again on its own output (1)
const flag = (value: unknown) => (value === "1" || value === 1 ? (1 as const) : undefined)

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): Partial<SearchParams> => ({
    q: textParam(search.q)?.slice(0, 100),
    sub: textParam(search.sub),
    tag: textParam(search.tag),
    brand: textParam(search.brand),
    size: textParam(search.size),
    food: oneOf(FoodType, search.food),
    offers: flag(search.offers),
    sort: oneOf(SearchSortBy, search.sort),
    exact: flag(search.exact),
  }),
  loaderDeps: ({ search }) => ({ ...search, q: search.q?.trim() ?? "" }),
  loader: async ({ deps }) => (deps.q
    ? { kind: "results" as const, page: await searchShop({ data: deps }) }
    : { kind: "landing" as const, page: await getSearchLanding() }),
  head: ({ loaderData }) => pageHead({
    title: loaderData?.kind === "results" ? `${loaderData.page.q}: search | Martly` : "Search | Martly",
    description: "Search products at your Martly store.",
    path: "/search",
    noindex: true,
  }),
  component: SearchPage,
})

function SearchPage() {
  const data = Route.useLoaderData()
  return (
    <ShopLayout store={data.page.store} q={data.kind === "results" ? data.page.q : undefined}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        {data.kind === "results" ? <SearchResults page={data.page} /> : <SearchLandingView landing={data.page} />}
      </div>
    </ShopLayout>
  )
}
