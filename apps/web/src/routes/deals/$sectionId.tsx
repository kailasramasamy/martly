import { createFileRoute, notFound } from "@tanstack/react-router"
import { getDeals } from "~/lib/api"
import { pageHead } from "~/lib/seo"
import { ListPageView, pageParam, textParam } from "~/components/list-page"

type Search = {
  band?: number
  category?: string
  page?: number
}

// A Home deals section in full; the section is an admin setting that comes and goes, so the page isn't indexed
export const Route = createFileRoute("/deals/$sectionId")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    band: Number(search.band) > 0 ? Math.floor(Number(search.band)) : undefined,
    category: textParam(search.category),
    page: pageParam(search.page),
  }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const page = await getDeals({ data: { sectionId: params.sectionId, ...deps } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => pageHead({
    title: `${loaderData?.title ?? "Deals"} | Martly`,
    description: `Deals at ${loaderData?.store.name ?? "your store"}, by price.`,
    path: `/deals/${params.sectionId}`,
    noindex: true,
  }),
  component: DealsPage,
})

function DealsPage() {
  const { sectionId } = Route.useParams()
  return <ListPageView page={Route.useLoaderData()} crumb="Deals" base={`/deals/${sectionId}`} params={Route.useSearch()} empty="No deals in this band right now." />
}
