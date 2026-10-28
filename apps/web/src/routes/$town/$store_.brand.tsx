import { createFileRoute, notFound } from "@tanstack/react-router"
import { getOwnBrand } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { ShopLayout } from "~/components/shop-layout"
import { listHref } from "~/components/list-page"
import { BrandListing } from "~/components/brand-listing"
import { isFilteredView, listSearch } from "~/components/category/filtered-list"

export const Route = createFileRoute("/$town/$store_/brand")({
  // The store as a brand, as in the app: its own brands and the staples it packs in its own bags
  validateSearch: listSearch,
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const page = await getOwnBrand({ data: { ...params, ...deps } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return pageHead({ title: "Not found | Martly", description: "", path: "/", noindex: true })
    const { store, page } = loaderData
    const path = `/${params.town}/${params.store}/brand`
    return pageHead({
      title: `${store.name}'s own brand in ${store.town.name}${page > 1 ? ` (page ${page})` : ""} | Martly`,
      description: `Rice, dals and staples ${store.name}, ${store.town.name} packs in its own bags, and its own brands, at the store's prices.`,
      path: listHref(path, { sub: loaderData.subcategory ?? undefined, page }),
      image: store.logoUrl,
      noindex: isFilteredView(loaderData),
      jsonLd: { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: store.name, path }]) },
    })
  },
  component: OwnBrandPage,
})

function OwnBrandPage() {
  const page = Route.useLoaderData()
  const { town, store } = Route.useParams()
  return (
    <ShopLayout store={page.store}>
      <BrandListing page={page} route="/$town/$store/brand" base={`/${town}/${store}/brand`} />
    </ShopLayout>
  )
}
