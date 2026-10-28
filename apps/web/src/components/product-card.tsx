import { useState } from "react"
import type { WebPack, WebProductCard } from "@martly/shared/types"
import { rupees } from "~/lib/format"
import { useAppSheet } from "./app-sheet"
import { Icon } from "./icons"

export const productPath = (slug: string) => `/p/${slug}`

export function PriceLine({ pack, large = false }: { pack: WebPack; large?: boolean }) {
  return (
    <span className="flex flex-wrap items-baseline gap-x-1.5">
      <span className={large ? "text-3xl font-extrabold" : "text-[15px] font-extrabold"}>{rupees(pack.price)}</span>
      {pack.mrp && <s className={large ? "text-lg text-muted" : "text-xs text-muted"}>{rupees(pack.mrp)}</s>}
    </span>
  )
}

/**
 * The pack size the shopper picked, by name so it survives a store change (each store has its own listings);
 * it opens on the first size in stock
 */
export function usePack(packs: WebPack[]) {
  const [name, setName] = useState<string | null>(null)
  const pack = packs.find((p) => p.name === name) ?? packs.find((p) => p.inStock) ?? packs[0]
  return [pack, (p: WebPack) => setName(p.name)] as const
}

function PackPicker({ packs, value, onChange, label }: { packs: WebPack[]; value: WebPack; onChange: (p: WebPack) => void; label: string }) {
  if (packs.length === 1) return <span className="block h-9 truncate pt-2 text-[13px] font-semibold text-muted">{value.name}</span>
  return (
    <span className="relative block">
      <select
        aria-label={`Pack size of ${label}`}
        value={value.id}
        onChange={(e) => onChange(packs.find((p) => p.id === e.target.value)!)}
        className="h-9 w-full appearance-none truncate rounded-lg border border-line bg-white pl-2.5 pr-7 text-[13px] font-semibold text-slate-700 focus:border-brand focus:outline-none"
      >
        {packs.map((p) => <option key={p.id} value={p.id}>{p.name} · {rupees(p.price)}</option>)}
      </select>
      <Icon name="chevron" size={15} className="pointer-events-none absolute right-2 top-[11px] text-muted" />
    </span>
  )
}

const ADD_SIZES = { regular: "min-w-[68px] px-3 text-sm", wide: "w-full text-base", compact: "h-9 min-w-[52px] px-2 text-xs" }

export function AddButton({ pack, name, size = "regular", onAdd }: { pack: WebPack; name: string; size?: keyof typeof ADD_SIZES; onAdd?: () => void }) {
  const openAppSheet = useAppSheet()
  if (!pack.inStock) return <span className="text-xs font-bold text-muted">Out of stock</span>
  return (
    <button
      onClick={() => { onAdd?.(); openAppSheet(name) }}
      aria-label={`Add ${name}, ${pack.name}`}
      className={`flex h-11 items-center justify-center rounded-xl border-2 border-brand bg-brand-tint font-extrabold text-brand hover:bg-brand hover:text-white ${ADD_SIZES[size]}`}
    >
      ADD
    </button>
  )
}

/** Search results say which cards are ads and report opens and ADDs; other lists leave these out */
export interface CardTracking {
  ad?: boolean
  onOpen?: () => void
  onAdd?: () => void
}

export function ProductCard({ product, tracking }: { product: WebProductCard; tracking?: CardTracking }) {
  const [pack, setPack] = usePack(product.packs)
  // A store that packs the product itself shows its own pack for the size picked
  const imageUrl = pack.imageUrl ?? product.imageUrl
  return (
    <article className="flex h-full flex-col rounded-2xl border border-line bg-white p-3 transition hover:shadow-lg hover:shadow-slate-200/70">
      <a href={productPath(product.slug)} onClick={tracking?.onOpen} className="group flex flex-1 flex-col">
        <span className="relative block overflow-hidden rounded-xl bg-surface">
          {imageUrl
            ? <img src={imageUrl} alt={product.name} loading="lazy" width={240} height={240} className="aspect-square w-full object-contain p-2 transition group-hover:scale-[1.03]" />
            : <span className="flex aspect-square items-center justify-center text-muted"><Icon name="basket" size={40} strokeWidth={1.5} /></span>}
          <span className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {pack.offer && (
              <span className="rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-extrabold text-white">Buy {pack.offer.buy} Get {pack.offer.get}</span>
            )}
            {pack.offPercent > 0 && (
              <span className="rounded-md bg-[#fcd34d] px-1.5 py-0.5 text-[11px] font-extrabold text-[#1c0a00]">{pack.offPercent}% OFF</span>
            )}
          </span>
        </span>
        <span className="mt-2.5 flex min-w-0 items-center gap-1.5">
          {tracking?.ad && <span className="shrink-0 rounded border border-line px-1 text-[10px] font-bold text-muted">Ad</span>}
          {product.brand && <span className="truncate text-[11px] font-bold uppercase tracking-wide text-muted">{product.brand}</span>}
        </span>
        <h3 className="mt-0.5 line-clamp-2 min-h-[40px] text-[14px] font-bold leading-5 group-hover:text-brand">{product.name}</h3>
      </a>
      <div className="mt-2"><PackPicker packs={product.packs} value={pack} onChange={setPack} label={product.name} /></div>
      <div className="mt-2.5 flex min-h-11 items-center justify-between gap-2">
        <PriceLine pack={pack} />
        <AddButton pack={pack} name={product.name} onAdd={tracking?.onAdd} />
      </div>
    </article>
  )
}

// Wide screens fit six across; beside a filter rail, four
export function ProductGrid({ products, beside = false }: { products: WebProductCard[]; beside?: boolean }) {
  return (
    <ul className={`grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 ${beside ? "xl:grid-cols-4" : "lg:grid-cols-5 xl:grid-cols-6"}`}>
      {products.map((p) => <li key={p.slug}><ProductCard product={p} /></li>)}
    </ul>
  )
}
