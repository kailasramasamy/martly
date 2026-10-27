import { createFileRoute, notFound } from "@tanstack/react-router"
import type { WebTownPage } from "@martly/shared/types"
import { getTownPage } from "~/lib/api"
import { pageHead, townJsonLd } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { InviteCard } from "~/components/stores-section"
import { TownStoreCard } from "~/components/town/store-card"
import { AppBand } from "~/components/bands"
import { Icon, type IconName } from "~/components/icons"

export const Route = createFileRoute("/$town/")({
  loader: async ({ params }) => {
    const page = await getTownPage({ data: params.town })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData: page }) => {
    if (!page) return { meta: [{ title: "Town not found | Martly" }, { name: "robots", content: "noindex" }] }
    return pageHead({
      title: `Grocery stores in ${page.town.name}: order online | Martly`,
      description: `Order groceries online from ${page.town.name}'s own stores on Martly: ${page.stores.map((s) => s.name).join(", ")}. The store packs and delivers, or keeps it ready for pickup.`,
      path: `/${page.town.slug}`,
      jsonLd: townJsonLd(page),
    })
  },
  component: TownPage,
  notFoundComponent: TownNotFound,
})

/** What the town's stores offer together: how many, the fastest delivery, how many open right now */
function townFacts({ stores }: WebTownPage) {
  const list: { icon: IconName; text: string }[] = [{ icon: "store", text: `${stores.length} ${stores.length === 1 ? "store" : "stores"} on Martly` }]
  const express = stores.map((s) => s.delivery.expressMinutes).filter((m): m is number => !!m)
  if (express.length) list.push({ icon: "bike", text: `Delivery from ${Math.min(...express)} min` })
  const open = stores.filter((s) => s.delivery.openNow).length
  if (open) list.push({ icon: "clock", text: `${open} open now` })
  return list
}

const STEPS = [
  { title: "Pick a store", text: "Each one lists its own shelves, prices and offers." },
  { title: "Order on the Martly app", text: "Browse here, then order in the app. Pay online or cash on delivery." },
  { title: "Get it home", text: "The store packs and delivers, or keeps it ready for pickup." },
]

function HowOrderingWorks() {
  return (
    <section aria-labelledby="how" className="mx-auto mt-14 max-w-7xl px-4 sm:px-6">
      <h2 id="how" className="text-2xl font-extrabold tracking-tight">How ordering works</h2>
      <ol className="mt-5 grid gap-4 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-4 rounded-2xl bg-surface p-5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand text-sm font-extrabold text-white">{i + 1}</span>
            <span><b className="block font-extrabold">{s.title}</b><span className="mt-0.5 block text-sm text-muted">{s.text}</span></span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function TownPage() {
  const page = Route.useLoaderData()
  const { town, stores } = page
  return (
    <ShopLayout store={null}>
      <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10">
        <Breadcrumbs items={[{ name: "Martly", path: "/" }, { name: town.name }]} />
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight sm:text-[40px]">Grocery stores in {town.name}</h1>
        <p className="mt-2 max-w-2xl text-base text-muted">
          {town.district !== town.name && `${town.name}, ${town.district} district. `}Shop your local store's shelves from home, at the store's own prices.
        </p>
        <ul className="mt-5 mb-8 flex flex-wrap gap-2">
          {townFacts(page).map((f) => (
            <li key={f.text} className="flex h-9 items-center gap-1.5 rounded-full bg-brand-tint px-3.5 text-[13px] font-bold text-brand-deep">
              <Icon name={f.icon} size={15} strokeWidth={2.25} />{f.text}
            </li>
          ))}
        </ul>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {stores.map((s) => <TownStoreCard key={s.slug} town={town} store={s} />)}
          {stores.length < 3 && <InviteCard townName={town.name} />}
        </div>
      </section>
      <HowOrderingWorks />
      <AppBand />
    </ShopLayout>
  )
}

function TownNotFound() {
  return (
    <ShopLayout store={null}>
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <h1 className="text-3xl font-extrabold">Martly isn't in this town yet</h1>
        <p className="mt-3 text-muted">We're adding towns as their stores join.</p>
        <a href="/#stores" className="mt-8 inline-flex h-12 items-center rounded-full bg-brand px-6 font-bold text-white">See towns on Martly</a>
      </div>
    </ShopLayout>
  )
}
