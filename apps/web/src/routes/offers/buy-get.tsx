import { createFileRoute, notFound } from "@tanstack/react-router"
import { getBuyGet } from "~/lib/api"
import { pageHead } from "~/lib/seo"
import { ListPageView, listHref, pageParam, textParam } from "~/components/list-page"

const PATH = "/offers/buy-get"

export const Route = createFileRoute("/offers/buy-get")({
  validateSearch: (search: Record<string, unknown>): { category?: string; page?: number } => ({ category: textParam(search.category), page: pageParam(search.page) }),
  loaderDeps: ({ search }) => search,
  loader: async ({ deps }) => {
    const page = await getBuyGet({ data: deps })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, match }) => pageHead({
    title: `Buy 1 Get 1 free offers in ${loaderData?.store.town.name ?? "your town"} | Martly`,
    description: `Every buy-one-get-one and free-item offer at ${loaderData?.store.name ?? "your store"} right now.`,
    path: listHref(PATH, match.search),
  }),
  component: () => <ListPageView page={Route.useLoaderData()} crumb="Buy 1 Get 1" base={PATH} params={Route.useSearch()} empty="No free-item offers here right now." />,
})
