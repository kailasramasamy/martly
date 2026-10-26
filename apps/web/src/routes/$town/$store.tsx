import { createFileRoute, notFound } from "@tanstack/react-router"
import type { WebStorePage } from "@martly/shared/types"
import { STORE_SIZE_RULES } from "@martly/shared/constants"
import { getStorePage } from "~/lib/api"
import { LINKS, SITE_URL } from "~/lib/site"
import { ShopLayout } from "~/components/shop-layout"
import { Backdrop } from "~/components/hero"
import { Icon } from "~/components/icons"
import { Facts } from "~/components/facts"
import { HowItWorks } from "~/components/how-it-works"
import { AppBand } from "~/components/bands"

function storeJsonLd({ store, town }: WebStorePage, url: string) {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "GroceryStore",
        name: store.name,
        url,
        image: store.imageUrl ?? store.logoUrl ?? undefined,
        address: { "@type": "PostalAddress", streetAddress: store.address, addressLocality: town.name, addressRegion: town.state, addressCountry: "IN" },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Martly", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: town.name, item: `${SITE_URL}/#stores` },
          { "@type": "ListItem", position: 3, name: store.name, item: url },
        ],
      },
    ],
  }
}

export const Route = createFileRoute("/$town/$store")({
  // Opening a store's page makes it the shopper's store (see getStorePage)
  loader: async ({ params }) => {
    const page = await getStorePage({ data: params })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Store not found | Martly" }, { name: "robots", content: "noindex" }] }
    const { store, town } = loaderData
    const url = `${SITE_URL}/${params.town}/${params.store}`
    const title = `${store.name}, ${town.name}: order groceries online | Martly`
    const description = `Order from ${store.name} in ${town.name} on Martly. ${store.tagline ?? "The store packs your order and delivers it, or keeps it ready for pickup."} Pay by UPI, card or cash.`
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:type", content: "website" },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:url", content: url },
        { property: "og:image", content: store.imageUrl ?? store.logoUrl ?? `${SITE_URL}/brand/app-icon.png` },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(storeJsonLd(loaderData, url)) }],
    }
  },
  component: StorePage,
  notFoundComponent: StoreNotFound,
})

function StoreHero({ page }: { page: WebStorePage }) {
  const { store, town } = page
  return (
    <section className="relative isolate overflow-hidden bg-brand-ink text-white">
      <Backdrop />
      <div className="mx-auto flex max-w-5xl flex-col items-center px-4 pb-16 pt-12 text-center sm:px-6 sm:pt-16">
        <nav aria-label="Breadcrumb" className="mb-8 text-sm text-teal-200">
          <a href="/" className="hover:text-white">Martly</a> / <a href="/#stores" className="hover:text-white">{town.name}</a> / <span className="text-white">{store.name}</span>
        </nav>
        {store.logoUrl
          ? <img src={store.logoUrl} alt={`${store.name} logo`} className="h-28 w-28 rounded-3xl bg-white object-contain p-2 shadow-2xl" />
          : <span className="flex h-28 w-28 items-center justify-center rounded-3xl bg-white text-brand"><Icon name="store" size={52} strokeWidth={1.5} /></span>}
        <h1 className="mt-7 text-4xl font-extrabold tracking-[-0.03em] sm:text-6xl">{store.name}</h1>
        {store.tagline && <p className="mt-4 max-w-xl text-lg text-teal-100">{store.tagline}</p>}
        <p className="mt-4 flex max-w-xl items-start gap-2 text-left text-[15px] leading-relaxed text-teal-100">
          <Icon name="pin" size={18} className="mt-0.5 shrink-0 text-amber" />
          {store.address}
        </p>
        {store.size && <span className="mt-5 rounded-full bg-white/10 px-3 py-1 text-sm font-bold">{STORE_SIZE_RULES[store.size].label}</span>}
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <a href="/" className="inline-flex h-[52px] items-center gap-2 rounded-[14px] bg-amber px-7 text-base font-extrabold text-amber-ink hover:bg-amber-300">
            Browse {store.name} <Icon name="arrow" size={18} />
          </a>
          <a href={LINKS.playStore} className="inline-flex h-[52px] items-center rounded-[14px] border border-white/20 px-7 text-base font-bold hover:bg-white/10">
            Order on the app
          </a>
        </div>
      </div>
    </section>
  )
}

function StorePage() {
  const page = Route.useLoaderData()
  const { store, town } = page
  return (
    <ShopLayout store={{ id: store.id, name: store.name, slug: store.slug, logoUrl: store.logoUrl, town: { name: town.name, slug: town.slug } }}>
      <StoreHero page={page} />
      <Facts />
      <HowItWorks />
      <AppBand />
    </ShopLayout>
  )
}

function StoreNotFound() {
  return (
    <ShopLayout store={null}>
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <h1 className="text-3xl font-extrabold">We couldn't find that store</h1>
        <p className="mt-3 text-muted">It may have moved, or isn't on Martly yet.</p>
        <a href="/#stores" className="mt-8 inline-flex h-12 items-center rounded-full bg-brand px-6 font-bold text-white">See stores on Martly</a>
      </div>
    </ShopLayout>
  )
}
