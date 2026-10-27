import { createFileRoute, notFound } from "@tanstack/react-router"
import { getStorePage } from "~/lib/api"
import { pageHead, storeJsonLd } from "~/lib/seo"
import { loadHomePage } from "~/lib/home-page"
import { ShopLayout } from "~/components/shop-layout"
import { HomePage } from "~/components/home/home-page"

export const Route = createFileRoute("/$town/$store")({
  // The store's own address: its shop, indexable under its name, and it becomes the shopper's store (see getStorePage)
  loader: async ({ params }) => {
    const store = await getStorePage({ data: params })
    if (!store) throw notFound()
    return { store, page: await loadHomePage({ id: store.store.id, town: store.town.slug }) }
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return { meta: [{ title: "Store not found | Martly" }, { name: "robots", content: "noindex" }] }
    const { store, town } = loaderData.store
    const path = `/${params.town}/${params.store}`
    return pageHead({
      title: `${store.name}, ${town.name}: order groceries online | Martly`,
      description: `Order from ${store.name} in ${town.name} on Martly. ${store.tagline ?? "The store packs your order and delivers it, or keeps it ready for pickup."} Pay by UPI, card or cash.`,
      path,
      image: store.imageUrl ?? store.logoUrl ?? undefined,
      jsonLd: storeJsonLd(loaderData.store, path),
    })
  },
  component: () => <HomePage page={Route.useLoaderData().page} />,
  notFoundComponent: StoreNotFound,
})

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
