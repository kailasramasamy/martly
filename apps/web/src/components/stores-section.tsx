import type { WebStore, WebTown } from "@martly/shared/types"
import { STORE_SIZE_RULES } from "@martly/shared/constants"
import { Icon } from "./icons"

export function storePath(town: { slug: string }, store: { slug: string }) {
  return `/${town.slug}/${store.slug}`
}

/** Street and area from a full address: "10A, Nethaji Bye-Pass Road, Salem Main Rd, Dharmapuri…" → "Nethaji Bye-Pass Road" */
function shortAddress(address: string) {
  const parts = address.split(",").map((p) => p.trim()).filter((p) => p && !/^\d/.test(p))
  return parts[0] ?? address
}

function StoreCover({ store }: { store: WebStore }) {
  if (store.imageUrl) {
    return <img src={store.imageUrl} alt={`${store.name} storefront`} loading="lazy" className="aspect-[16/10] w-full object-cover" />
  }
  return (
    <div className="flex aspect-[16/10] w-full items-center justify-center bg-brand-tint">
      {store.logoUrl
        ? <img src={store.logoUrl} alt={`${store.name} logo`} loading="lazy" className="h-28 w-28 rounded-3xl bg-white object-contain p-2 shadow-sm" />
        : <Icon name="store" size={56} className="text-brand" strokeWidth={1.5} />}
    </div>
  )
}

function StoreCard({ town, store }: { town: WebTown; store: WebStore }) {
  return (
    <a href={storePath(town, store)} className="group block overflow-hidden rounded-[20px] border border-line bg-white transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-slate-200">
      <StoreCover store={store} />
      <div className="p-5">
        <h3 className="text-lg font-extrabold">{store.name}</h3>
        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{store.tagline ?? shortAddress(store.address)}</p>
        <div className="mt-4 flex items-center justify-between gap-3">
          <span className="flex flex-wrap gap-2">
            {store.size && <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-deep">{STORE_SIZE_RULES[store.size].label}</span>}
            <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-slate-600">{town.name}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-extrabold text-brand">
            Shop <Icon name="arrow" size={16} className="transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </a>
  )
}

/** Fills a thin town's row and asks the shops shoppers miss to join */
export function InviteCard({ townName }: { townName: string }) {
  return (
    <a href="/for-stores" className="flex flex-col justify-center rounded-[20px] border-2 border-dashed border-line p-6 text-center hover:border-brand">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint text-brand">
        <Icon name="plus" size={26} />
      </span>
      <span className="mt-4 text-lg font-extrabold">More {townName} stores joining</span>
      <span className="mt-1 text-sm leading-relaxed text-muted">Own a shop here? Bring it online with Martly.</span>
    </a>
  )
}

/** A town's live stores as cards, topped up with an invite while the town has few */
export function TownStoreGrid({ town }: { town: WebTown }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {town.stores.map((s) => <StoreCard key={s.slug} town={town} store={s} />)}
      {town.stores.length < 4 && <InviteCard townName={town.name} />}
    </div>
  )
}

export function StoresSection({ towns, selected, onSelect }: { towns: WebTown[]; selected: WebTown | undefined; onSelect: (slug: string) => void }) {
  if (!selected) return null
  return (
    <section id="stores" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-16 sm:px-6 sm:pt-20">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-[34px]">Stores in {selected.name}</h2>
          <p className="mt-2 text-base text-muted">Pick a store and shop its shelves from home.</p>
        </div>
        {towns.length > 1 && (
          <div role="tablist" aria-label="Towns" className="flex flex-wrap gap-2">
            {towns.map((t) => (
              <button
                key={t.slug}
                role="tab"
                aria-selected={t.slug === selected.slug}
                onClick={() => onSelect(t.slug)}
                className="h-11 rounded-full border border-line px-4 text-sm font-bold aria-selected:border-brand aria-selected:bg-brand aria-selected:text-white"
              >
                {t.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <TownStoreGrid town={selected} />
    </section>
  )
}
