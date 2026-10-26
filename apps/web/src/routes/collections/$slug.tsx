import { createFileRoute, notFound } from "@tanstack/react-router"
import { getCollection } from "~/lib/api"
import { breadcrumbJsonLd, pageHead } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { ProductGrid } from "~/components/product-card"
import { FilterChips, listHref, Pager, pageParam, textParam } from "~/components/list-page"
import { FESTIVE_FONTS } from "~/components/home/banners"
import { Countdown } from "~/components/home/campaign"

type Search = {
  aisle?: string
  tile?: string
  page?: number
}

export const Route = createFileRoute("/collections/$slug")({
  validateSearch: (search: Record<string, unknown>): Search => ({ aisle: textParam(search.aisle), tile: textParam(search.tile), page: pageParam(search.page) }),
  loaderDeps: ({ search }) => search,
  loader: async ({ params, deps }) => {
    const page = await getCollection({ data: { slug: params.slug, ...deps } })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, match }) => {
    if (!loaderData) return pageHead({ title: "This offer has ended | Martly", description: "", path: "/", noindex: true })
    const { collection, store } = loaderData
    const path = `/collections/${collection.slug}`
    const filtered = Object.values(match.search).some(Boolean)
    return pageHead({
      title: `${collection.title} at ${store.name}, ${store.town.name} | Martly`,
      description: collection.subtitle ?? `${collection.title}: shop the range online from ${store.name}, ${store.town.name}.`,
      path: filtered ? listHref(path, match.search) : path,
      image: collection.imageUrl,
      jsonLd: { "@context": "https://schema.org", ...breadcrumbJsonLd([{ name: collection.title, path }]) },
    })
  },
  component: CollectionPage,
})

function CollectionPage() {
  const page = Route.useLoaderData()
  const search = Route.useSearch()
  const { collection } = page
  const base = `/collections/${collection.slug}`
  const theme = collection.theme ?? { background: "#f0fdfa", title: "#115e59", dark: false }
  return (
    <ShopLayout store={page.store}>
      <div style={{ background: `linear-gradient(180deg, ${theme.background}, #fff)` }}>
        <div className="mx-auto max-w-7xl px-4 pb-2 pt-6 sm:px-6">
          <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: collection.title }]} />
          <div className="mt-3 flex items-center gap-4" style={{ color: theme.title }}>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {collection.offerLabel && <span className="rounded-lg bg-amber px-2.5 py-1 text-sm font-extrabold text-amber-ink">{collection.offerLabel}</span>}
                {collection.endsAt && <Countdown endsAt={collection.endsAt} ink={theme.title} />}
              </div>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl" style={theme.font ? { fontFamily: FESTIVE_FONTS[theme.font], fontWeight: 700 } : undefined}>
                {collection.title}
              </h1>
              {collection.subtitle && <p className="mt-1 font-medium opacity-80">{collection.subtitle}</p>}
            </div>
            {collection.imageUrl && <img src={collection.imageUrl} alt="" className="hidden max-h-40 w-auto max-w-[40%] rounded-2xl object-contain sm:block" />}
          </div>
          <FilterChips items={page.aisles} all={base} />
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mt-6">
          {page.products.length
            ? <ProductGrid products={page.products} />
            : <p className="py-16 text-center text-muted">Nothing here at {page.store.name} right now.</p>}
        </div>
        <Pager page={page.page} totalPages={page.totalPages} href={(n) => listHref(base, { ...search, page: n })} />
      </div>
    </ShopLayout>
  )
}
