import { createFileRoute, notFound } from "@tanstack/react-router"
import { getBrands } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { BrandDirectory } from "~/components/brands"

export const Route = createFileRoute("/brands/")({
  loader: async () => {
    const page = await getBrands()
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => {
    if (!loaderData) return pageHead({ title: "Brands | Martly", description: "", path: "/", noindex: true })
    const { store, brands, popular } = loaderData
    const known = popular.slice(0, 4).flatMap((slug) => brands.find((b) => b.slug === slug)?.name ?? []).join(", ")
    return pageHead({
      title: `Shop by brand in ${store.town.name}: ${brands.length} brands | Martly`,
      description: `Every brand ${store.name}, ${store.town.name} stocks, A to Z: ${known} and more, at the store's prices.`,
      path: "/brands",
      jsonLd: { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: "Brands", path: "/brands" }]) },
    })
  },
  component: BrandsPage,
})

function BrandsPage() {
  const page = Route.useLoaderData()
  return (
    <ShopLayout store={page.store}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Brands" }]} />
        <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Shop by brand</h1>
        <p className="mt-1 text-sm text-muted">{page.brands.length} brands at {page.store.name}</p>
        <BrandDirectory page={page} />
      </div>
    </ShopLayout>
  )
}
