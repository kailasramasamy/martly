import { useState } from "react"
import { createFileRoute, notFound } from "@tanstack/react-router"
import type { WebInfoRow, WebPack, WebProductInfo, WebProductPage } from "@martly/shared/types"
import { getProduct } from "~/lib/api"
import { rupees } from "~/lib/format"
import { pageHead, productJsonLd } from "~/lib/seo"
import { Breadcrumbs, ShopLayout } from "~/components/shop-layout"
import { AddButton, PriceLine, usePack } from "~/components/product-card"
import { Shelf } from "~/components/shelf"
import { Icon } from "~/components/icons"
import { BrandChip } from "~/components/brand-promo"

export const Route = createFileRoute("/p/$slug")({
  loader: async ({ params }) => {
    const page = await getProduct({ data: params })
    if (!page) throw notFound()
    return page
  },
  head: ({ loaderData }) => {
    if (!loaderData) return pageHead({ title: "Product not found | Martly", description: "", path: "/", noindex: true })
    const { product, packs, store } = loaderData
    const from = packs.length ? ` from ${rupees(Math.min(...packs.map((p) => p.price)))}` : ""
    return pageHead({
      title: `${product.name}${from}: buy online in ${store.town.name} | Martly`,
      description: `Buy ${product.name}${from} at ${store.name}, ${store.town.name}. ${packs.length > 1 ? `${packs.length} pack sizes. ` : ""}Packed and delivered by the store; pay by UPI, card or cash.`,
      path: `/p/${product.slug}`,
      image: product.images[0],
      jsonLd: productJsonLd(loaderData),
    })
  },
  component: ProductPage,
})

function Gallery({ images, name }: { images: string[]; name: string }) {
  const [shown, setShown] = useState(0)
  return (
    <div>
      <div className="overflow-hidden rounded-[24px] border border-line bg-surface">
        {images.length
          ? <img src={images[shown]} alt={name} width={640} height={640} className="aspect-square w-full object-contain mix-blend-multiply p-6" />
          : <span className="flex aspect-square items-center justify-center text-muted"><Icon name="basket" size={64} strokeWidth={1.25} /></span>}
      </div>
      {images.length > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto">
          {images.map((src, i) => (
            <li key={src} className="shrink-0">
              <button onClick={() => setShown(i)} aria-label={`Photo ${i + 1}`} aria-pressed={i === shown} className="block h-16 w-16 overflow-hidden rounded-xl border-2 border-transparent bg-surface aria-pressed:border-brand">
                <img src={src} alt="" loading="lazy" className="h-full w-full object-contain mix-blend-multiply p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function PackOptions({ packs, value, onChange }: { packs: WebPack[]; value: WebPack; onChange: (p: WebPack) => void }) {
  return (
    <fieldset className="mt-6">
      <legend className="text-sm font-extrabold">Pack size</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {packs.map((p) => (
          <button
            key={p.id}
            onClick={() => onChange(p)}
            aria-pressed={p.id === value.id}
            className="relative rounded-xl border border-line px-3 py-2.5 text-left hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand-tint"
          >
            <span className="block text-sm font-bold">{p.name}</span>
            <span className="block text-sm text-slate-600">{rupees(p.price)}{!p.inStock && <span className="text-muted"> · Out of stock</span>}</span>
            {p.offPercent > 0 && <span className="absolute right-2 top-2 rounded bg-[#fcd34d] px-1 text-[10px] font-extrabold text-[#1c0a00]">{p.offPercent}% OFF</span>}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function BuyBox({ page, pack, setPack }: { page: WebProductPage; pack: WebPack | undefined; setPack: (p: WebPack) => void }) {
  const { product, packs, store } = page
  if (!pack) {
    return <p className="mt-6 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900">{store.name} doesn't sell this right now. Change your store at the top of the page to see where it's in stock.</p>
  }
  return (
    <div>
      <div className="mt-5 flex items-center gap-3">
        <PriceLine pack={pack} large />
        {pack.offPercent > 0 && <span className="rounded-md bg-[#fcd34d] px-2 py-0.5 text-sm font-extrabold text-[#1c0a00]">{pack.offPercent}% OFF</span>}
      </div>
      <p className="mt-1 text-sm text-muted">{pack.name} · price at {store.name}, inclusive of taxes</p>
      {packs.length > 1 && <PackOptions packs={packs} value={pack} onChange={setPack} />}
      <div className="mt-6 max-w-xs"><AddButton pack={pack} name={product.name} size="wide" /></div>
    </div>
  )
}

function AboutItem({ points }: { points: string[] }) {
  if (points.length === 0) return null
  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="text-lg font-extrabold tracking-tight">About this item</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-slate-700 marker:text-muted">
        {points.map((point) => <li key={point}>{point}</li>)}
      </ul>
    </section>
  )
}

function InfoTable({ title, caption, rows }: { title: string; caption?: string | null; rows: WebInfoRow[] }) {
  return (
    <section className="min-w-0">
      <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
      {caption && <p className="mt-1 text-sm text-muted">Per {caption}</p>}
      <div className="mt-3 overflow-hidden rounded-xl border border-line">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" className="w-2/5 bg-surface px-4 py-2.5 text-left align-top font-bold text-slate-600">{r.label}</th>
                <td className="px-4 py-2.5 align-top">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function ImportantInfo({ rows }: { rows: WebInfoRow[] }) {
  const blocks = [
    ...rows,
    { label: "Legal disclaimer", value: "Product details and nutrition values are for reference and may vary by pack. Always read the label on the pack before use." },
  ]
  return (
    <section className="mt-10">
      <h2 className="text-lg font-extrabold tracking-tight">Important information</h2>
      <div className="mt-3 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((b) => (
          <div key={b.label}>
            <h3 className="text-sm font-extrabold">{b.label}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-700">{b.value}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function ProductInformation({ info }: { info: WebProductInfo }) {
  return (
    <div className="mx-auto mt-12 max-w-7xl border-t border-line px-4 pt-8 sm:px-6">
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        {info.details.length > 0 && <InfoTable title="Product information" rows={info.details} />}
        {info.nutrition && <InfoTable title="Nutrition facts" caption={info.nutrition.per} rows={info.nutrition.rows} />}
      </div>
      <ImportantInfo rows={info.important} />
    </div>
  )
}

function ProductPage() {
  const page = Route.useLoaderData()
  const { product, store, related, brand } = page
  const [pack, setPack] = usePack(page.packs)
  // The picked size's own photo leads the gallery
  const images = [...new Set([pack?.imageUrl, ...product.images].filter((u): u is string => Boolean(u)))]
  return (
    <ShopLayout store={store}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, ...product.trail, { name: product.name }]} />
        <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-14 [&>*]:min-w-0">
          <Gallery key={pack?.id} images={images} name={product.name} />
          <div>
            {brand && <BrandChip brand={brand} />}
            <h1 className="mt-2 text-2xl font-extrabold leading-tight tracking-tight sm:text-[34px]">{product.name}</h1>
            <BuyBox page={page} pack={pack} setPack={setPack} />
            <AboutItem points={product.info.highlights} />
          </div>
        </div>
      </div>
      <ProductInformation info={product.info} />
      <Shelf id="related" title="You may also like" products={related} />
    </ShopLayout>
  )
}
