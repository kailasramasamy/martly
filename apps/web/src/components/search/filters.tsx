import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { FoodType, FoodTypeLabels, SearchSortBy, SearchSortLabels } from "@martly/shared/constants"
import type { WebSearchFacets, WebSearchFilters } from "@martly/shared/types"
import type { SearchParams } from "~/lib/api"
import { Icon } from "../icons"

export type SearchQuery = Partial<SearchParams>

/** The URL for a search with these filters changed; defaults are left out so each search has one URL */
export function searchFor(q: string, f: WebSearchFilters, change: Partial<WebSearchFilters> = {}): SearchQuery {
  const next = { ...f, ...change }
  return {
    q,
    sub: next.sub,
    tag: next.tag,
    brand: next.brand.length ? next.brand.join(",") : undefined,
    size: next.size,
    food: next.food,
    offers: next.offers ? 1 : undefined,
    sort: next.sort === SearchSortBy.RELEVANCE ? undefined : next.sort,
    exact: next.exact ? 1 : undefined,
  }
}

const PILL = "flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-bold"
const pillLook = (active: boolean) => (active ? "border-brand bg-brand-tint text-brand" : "border-line bg-white hover:border-brand")

/** A pill that opens a panel: dropped under it on wider screens, a bottom sheet on phones */
export function Menu({ label, active, badge, icon, align = "left", children }: {
  label: string; active: boolean; badge?: number; icon?: "sliders"; align?: "left" | "right"; children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false) }
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("pointerdown", outside)
    document.addEventListener("keydown", escape)
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape) }
  }, [open])
  const close = () => setOpen(false)
  return (
    <div ref={root} className="sm:relative">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className={`${PILL} ${pillLook(active)}`}>
        {icon && <Icon name={icon} size={16} />}
        {label}
        {!!badge && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-brand px-1 text-[11px] text-white">{badge}</span>}
        <Icon name="chevron" size={14} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-slate-900/40 sm:hidden" onClick={close} aria-hidden="true" />
          <div role="dialog" aria-label={label} className={`fixed inset-x-0 bottom-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl bg-white p-4 pb-6 shadow-2xl sm:absolute sm:inset-x-auto sm:bottom-auto ${align === "left" ? "sm:left-0" : "sm:right-0"} sm:top-[52px] sm:w-80 sm:rounded-2xl sm:border sm:border-line sm:shadow-xl`}>
            {children(close)}
          </div>
        </>
      )}
    </div>
  )
}

/** Picks from a list, each a link to the search with that choice, ticked when it is the one in use */
function Choices({ items, close }: { items: { label: string; search: SearchQuery; on: boolean; note?: string }[]; close: () => void }) {
  return (
    <ul>
      {items.map((i) => (
        <li key={i.label}>
          <Link to="/search" search={i.search} onClick={close} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 text-[15px] font-semibold hover:bg-surface ${i.on ? "text-brand" : ""}`}>
            <span>{i.label}{i.note && <span className="ml-1.5 text-sm font-medium text-muted">{i.note}</span>}</span>
            {i.on && <Icon name="check" size={18} />}
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** Brands and food type together, applied at once, like the app's filter sheet; the Brand pill opens it with brands only */
function FilterPanel({ q, filters, facets, close, brandsOnly = false }: {
  q: string; filters: WebSearchFilters; facets: WebSearchFacets; close: () => void; brandsOnly?: boolean
}) {
  const [brands, setBrands] = useState(filters.brand)
  const [food, setFood] = useState(filters.food)
  const navigate = useNavigate()
  const toggle = (slug: string) => setBrands((b) => (b.includes(slug) ? b.filter((s) => s !== slug) : [...b, slug]))
  const apply = (brand: string[], foodType: string | undefined) => {
    close()
    void navigate({ to: "/search", search: searchFor(q, filters, { brand, food: foodType }) })
  }
  const box = "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold hover:bg-surface"
  return (
    <div>
      {facets.brands.length > 0 && <h3 className="px-3 pb-1 text-xs font-extrabold uppercase tracking-wide text-muted">Brand</h3>}
      {facets.brands.map((b) => (
        <label key={b.slug} className={box}>
          <input type="checkbox" checked={brands.includes(b.slug)} onChange={() => toggle(b.slug)} className="h-5 w-5 accent-brand" />
          <span className="flex-1">{b.name}</span><span className="text-sm text-muted">{b.count}</span>
        </label>
      ))}
      {!brandsOnly && <h3 className="px-3 pb-1 pt-3 text-xs font-extrabold uppercase tracking-wide text-muted">Food type</h3>}
      {!brandsOnly && Object.values(FoodType).map((type) => (
        <label key={type} className={box}>
          <input type="radio" name="food" checked={food === type} onChange={() => setFood(type)} onClick={() => food === type && setFood(undefined)} className="h-5 w-5 accent-brand" />
          {FoodTypeLabels[type]}
        </label>
      ))}
      <div className="sticky -bottom-6 -mx-4 mt-4 flex gap-3 border-t border-line bg-white px-4 pb-6 pt-3 sm:-bottom-4 sm:pb-4">
        <button type="button" onClick={() => apply([], brandsOnly ? food : undefined)} className="h-11 flex-1 rounded-full border border-line text-sm font-bold hover:border-brand">Clear</button>
        <button type="button" onClick={() => apply(brands, food)} className="h-11 flex-1 rounded-full bg-brand text-sm font-bold text-white hover:bg-brand-deep">Apply</button>
      </div>
    </div>
  )
}

/** Filters, sort, size and the offers switch, as the app's control bar orders them */
export function ControlBar({ q, filters, facets }: { q: string; filters: WebSearchFilters; facets: WebSearchFacets }) {
  const filterCount = filters.brand.length + (filters.food ? 1 : 0)
  const sorts = Object.values(SearchSortBy).map((sort) => ({ label: SearchSortLabels[sort], search: searchFor(q, filters, { sort }), on: filters.sort === sort }))
  const sizes = [
    { label: "Any size", search: searchFor(q, filters, { size: undefined }), on: !filters.size },
    ...facets.sizes.map((s) => ({ label: s.label, note: String(s.count), search: searchFor(q, filters, { size: s.label }), on: filters.size === s.label })),
  ]
  return (
    <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <Menu label="Filters" icon="sliders" active={filterCount > 0} badge={filterCount}>
        {(close) => <FilterPanel q={q} filters={filters} facets={facets} close={close} />}
      </Menu>
      {(facets.brands.length > 1 || filters.brand.length > 0) && (
        <Menu label="Brand" active={filters.brand.length > 0} badge={filters.brand.length}>
          {(close) => <FilterPanel q={q} filters={filters} facets={facets} close={close} brandsOnly />}
        </Menu>
      )}
      <Menu label={filters.sort === SearchSortBy.RELEVANCE ? "Sort" : SearchSortLabels[filters.sort]} active={filters.sort !== SearchSortBy.RELEVANCE}>
        {(close) => <Choices items={sorts} close={close} />}
      </Menu>
      {(facets.sizes.length > 0 || !!filters.size) && (
        <Menu label={filters.size ?? "Size"} active={!!filters.size}>{(close) => <Choices items={sizes} close={close} />}</Menu>
      )}
      {(facets.offerCount > 0 || filters.offers) && (
        <Link to="/search" search={searchFor(q, filters, { offers: !filters.offers })} aria-pressed={filters.offers}
          className={`${PILL} ${filters.offers ? "border-brand bg-brand text-white" : "border-line bg-white hover:border-brand"}`}>
          Offers
        </Link>
      )}
    </div>
  )
}
