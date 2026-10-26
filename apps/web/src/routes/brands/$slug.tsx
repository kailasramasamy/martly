import { createFileRoute, notFound } from "@tanstack/react-router"
import { getBrand } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { ListPageView, listHref, pageParam } from "~/components/list-page"

export const Route = createFileRoute("/brands/$slug")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => ({ page: pageParam(search.page) }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const page = await getBrand({ data: { slug: params.slug, ...deps } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params, match }) => {
    if (!loaderData) return pageHead({ title: "Brand not found | Martly", description: "", path: "/", noindex: true })
    const { title, store } = loaderData
    const path = `/brands/${params.slug}`
    return pageHead({
      title: `${title} products in ${store.town.name}: buy online | Martly`,
      description: `Shop ${title} online from ${store.name}, ${store.town.name}: every ${title} product and pack size the store stocks, at its prices.`,
      path: listHref(path, match.search),
      image: loaderData.imageUrl,
      jsonLd: { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: title, path }]) },
    })
  },
  component: BrandPage,
})

function BrandPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  const logo = page.imageUrl && <img src={page.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border border-line bg-white object-contain p-2" />
  return <ListPageView page={page} crumb={page.title} base={`/brands/${slug}`} params={Route.useSearch()} header={logo} empty={`No ${page.title} products at ${page.store.name} right now.`} />
}
