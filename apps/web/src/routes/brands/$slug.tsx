import { createFileRoute, notFound } from "@tanstack/react-router"
import { getBrand } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { ShopLayout } from "~/components/shop-layout"
import { listHref } from "~/components/list-page"
import { BrandListing } from "~/components/brand-listing"
import { isFilteredView, listSearch } from "~/components/category/filtered-list"

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
      jsonLd: { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: "Brands", path: "/brands" }, { name: brand.name, path }]) },
    })
  },
  component: BrandPage,
})

function BrandPage() {
  const page = Route.useLoaderData()
  const { slug } = Route.useParams()
  return (
    <ShopLayout store={page.store}>
      <BrandListing page={page} route="/brands/$slug" base={`/brands/${slug}`} />
    </ShopLayout>
  )
}
