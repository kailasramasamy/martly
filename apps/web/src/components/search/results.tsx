import { useCallback, useEffect, useRef } from "react"
import { Link } from "@tanstack/react-router"
import { SearchEventType } from "@martly/shared/constants"
import type { WebSearchCard, WebSearchFacets, WebSearchFilters, WebSearchPage } from "@martly/shared/types"
import { logSearch, logSearchEvent } from "~/lib/api"
import { recordAd, useAdView } from "~/lib/ad-events"
import { addRecentSearch } from "~/lib/recent-searches"
import { ProductCard } from "../product-card"
import { Icon } from "../icons"
import { ControlBar, searchFor } from "./filters"

// Fewer brands than this and a brand row adds nothing (e.g. searching "surf excel")
const MIN_BRANDS = 3

/**
 * Logs the search once per query at the store, as the app does when a search is acted on, and saves it to recents
 * when it found something; result opens and ADDs are then logged against it with their place in the results
 */
function useSearchLog(storeId: string, q: string, resultCount: number) {
  const logged = useRef<{ key: string; id: Promise<string | null> } | null>(null)
  const key = `${storeId}:${q.toLowerCase()}`
  useEffect(() => {
    if (logged.current?.key === key) return
    logged.current = { key, id: logSearch({ data: { storeId, query: q, resultCount } }) }
    if (resultCount > 0) addRecentSearch(q)
  }, [key, storeId, q, resultCount])
  return useCallback((product: string, type: SearchEventType, position: number) => {
    const current = logged.current
    if (current?.key !== key) return
    void current.id.then((id) => { if (id) void logSearchEvent({ data: { searchLogId: id, product, type, position } }) })
  }, [key])
}

function Tabs({ q, filters, tabs }: { q: string; filters: WebSearchFilters; tabs: WebSearchFacets["tabs"] }) {
  if (!tabs.length) return null
  const active = filters.sub ?? filters.tag
  const tab = "flex w-[76px] shrink-0 flex-col items-center gap-1.5 rounded-xl px-1 pb-2 pt-1 text-center text-xs font-bold"
  return (
    <ul className="-mx-4 mt-4 flex gap-1 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {[{ kind: "all" as const, value: "", label: "All", name: "All results", imageUrl: null, count: 0 }, ...tabs].map((t) => {
        const on = t.kind === "all" ? !active : active === t.value
        const change = t.kind === "sub" ? { sub: t.value, tag: undefined } : t.kind === "tag" ? { tag: t.value, sub: undefined } : { sub: undefined, tag: undefined }
        return (
          <li key={`${t.kind}-${t.value}`}>
            <Link to="/search" search={searchFor(q, filters, { ...change, brand: [], size: undefined })} title={t.name} aria-current={on ? "page" : undefined}
              className={`${tab} ${on ? "bg-brand-tint text-brand" : "text-slate-600 hover:text-brand"}`}>
              <span className={`flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border-2 bg-surface ${on ? "border-brand" : "border-transparent"}`}>
                {t.imageUrl ? <img src={t.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-1" /> : <Icon name={t.kind === "all" ? "basket" : "search"} size={22} />}
              </span>
              <span className="line-clamp-2 leading-tight">{t.label}</span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** A quick single-brand jump: a tap shows only that brand, a second tap clears it; several brands go through Filters */
function BrandRow({ q, filters, brands }: { q: string; filters: WebSearchFilters; brands: WebSearchFacets["brands"] }) {
  if (brands.length < MIN_BRANDS && !filters.brand.length) return null
  return (
    <ul className="-mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {brands.map((b) => {
        const on = filters.brand.length === 1 && filters.brand[0] === b.slug
        return (
          <li key={b.slug} className="shrink-0">
            <Link to="/search" search={searchFor(q, filters, { brand: on ? [] : [b.slug] })} aria-pressed={on}
              className={`flex h-11 items-center gap-2 rounded-full border pl-1.5 pr-4 text-sm font-bold ${on ? "border-brand bg-brand-tint text-brand" : "border-line bg-white hover:border-brand"}`}>
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-surface text-xs font-extrabold text-muted">
                {b.imageUrl ? <img src={b.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain" /> : b.name.slice(0, 1)}
              </span>
              {b.name}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/** Says when the search ran on other words than typed; a spelling fix can be undone with "Search instead for" */
function MetaBanner({ page }: { page: WebSearchPage }) {
  if (!page.meta) return null
  const shown = page.meta.correctedQuery ?? page.meta.expandedTerms?.join(", ") ?? "similar products"
  return (
    <div className="mt-4 rounded-xl border border-[#ccfbf1] bg-brand-tint px-4 py-2.5 text-sm font-medium text-muted">
      <p>Showing results for <b className="font-bold text-ink">{shown}</b></p>
      {page.meta.correctedQuery && (
        <p className="mt-0.5">
          Search instead for <Link to="/search" search={searchFor(page.q, page.filters, { exact: true })} className="font-bold text-brand underline">{page.q}</Link>
        </p>
      )}
    </div>
  )
}

function ResultCard({ product, position, storeId, track }: {
  product: WebSearchCard; position: number; storeId: string; track: (product: string, type: SearchEventType, position: number) => void
}) {
  const { adBannerId } = product
  useAdView(storeId, adBannerId)
  const act = (type: SearchEventType) => {
    if (adBannerId) recordAd(storeId, { bannerId: adBannerId, type: "TAP" })
    track(product.slug, type, position)
  }
  return <ProductCard product={product} tracking={{ ad: !!adBannerId, onOpen: () => act(SearchEventType.CLICK), onAdd: () => act(SearchEventType.ADD_TO_CART) }} />
}

const filtered = (f: WebSearchFilters) => !!(f.sub || f.tag || f.brand.length || f.size || f.food || f.offers)

export function SearchResults({ page }: { page: WebSearchPage }) {
  const { store, q, products, facets, filters } = page
  const track = useSearchLog(store.id, q, products.length)
  return (
    <>
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Results for “{q}”</h1>
      <p className="mt-1 text-sm text-muted">{products.length} products at {store.name}</p>
      {facets && <Tabs q={q} filters={filters} tabs={facets.tabs} />}
      {facets && <ControlBar q={q} filters={filters} facets={facets} />}
      {facets && <BrandRow q={q} filters={filters} brands={facets.brands} />}
      <MetaBanner page={page} />
      <div className="mt-6">
        {products.length ? (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-5 xl:grid-cols-6">
            {products.map((p, i) => <li key={p.slug}><ResultCard product={p} position={i} storeId={store.id} track={track} /></li>)}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-4 py-16 text-center text-muted">
            <p>{filtered(filters) ? "No products match these filters." : `Nothing matches “${q}” at ${store.name}. Try another word.`}</p>
            {filtered(filters) && (
              <Link to="/search" search={{ q }} className="flex h-11 items-center rounded-full bg-brand px-6 text-sm font-bold text-white hover:bg-brand-deep">Clear filters</Link>
            )}
          </div>
        )}
      </div>
    </>
  )
}
