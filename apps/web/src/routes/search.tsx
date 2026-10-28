import { createFileRoute } from "@tanstack/react-router"
import { getSearchLanding, searchShop, type SearchParams } from "~/lib/api"
import { pageHead } from "~/lib/seo"
import { ShopLayout } from "~/components/shop-layout"
import { flag, textParam } from "~/components/list-page"
import { listSearch } from "~/components/category/filtered-list"
import { SearchLandingView } from "~/components/search/landing"
import { SearchResults } from "~/components/search/results"

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): Partial<SearchParams> => {
    const { page: _, ...filters } = listSearch(search)
    return { q: textParam(search.q)?.slice(0, 100), tag: textParam(search.tag), size: textParam(search.size), exact: flag(search.exact), ...filters }
  },
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
