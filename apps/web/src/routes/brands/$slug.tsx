import { createFileRoute, notFound } from "@tanstack/react-router"
import { getBrand } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { listHref } from "~/components/list-page"
import { FilteredListView, isFilteredView, listSearch } from "~/components/category/filtered-list"

export const Route = createFileRoute("/brands/$slug")({
  validateSearch: listSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const page = await getBrand({ data: { slug: params.slug, ...deps } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return pageHead({ title: "Brand not found | Martly", description: "", path: "/", noindex: true })
    const { brand, store, subcategory, subcategories, page } = loaderData
    const path = `/brands/${params.slug}`
    const sub = subcategories.find((s) => s.slug === subcategory)
    const name = sub ? `${brand.name} ${sub.name}` : brand.name
    return pageHead({
      title: `${name} products in ${store.town.name}${page > 1 ? ` (page ${page})` : ""}: buy online | Martly`,
      description: `Shop ${name} online from ${store.name}, ${store.town.name}: every ${brand.name} product and pack size the store stocks, at its prices.`,
      path: listHref(path, { sub: subcategory ?? undefined, page }),
      image: brand.imageUrl,
      noindex: isFilteredView(loaderData),
      jsonLd: { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: brand.name, path }]) },
    })
  },
  component: BrandPage,
})

function BrandPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  const total = page.subcategories.reduce((sum, s) => sum + s.count, 0)
  return (
    <ShopLayout store={page.store}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: page.brand.name }]} />
        <div className="mt-3 flex items-center gap-4">
          {page.brand.imageUrl && <img src={page.brand.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border border-line bg-white object-contain p-2" />}
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{page.brand.name}</h1>
            <p className="mt-1 text-sm text-muted">{total} products at {page.store.name}</p>
          </div>
        </div>
        <FilteredListView list={page} route="/brands/$slug" base={`/brands/${slug}`} empty={`No ${page.brand.name} products at ${page.store.name} right now.`} />
      </div>
    </ShopLayout>
  )
}
