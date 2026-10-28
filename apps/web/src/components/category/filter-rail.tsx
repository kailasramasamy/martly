import { createContext, useContext, useState, type ComponentProps, type FormEvent, type ReactNode } from "react"
import { Link, useNavigate } from "@tanstack/react-router"
import { FoodTypeLabels, formatPriceRange, SearchSortBy, type PriceRange } from "@martly/shared/constants"
import type { WebCategoryFilters, WebFilteredList } from "@martly/shared/types"
import type { CategorySearch } from "~/lib/api"
import { rupees } from "~/lib/format"
import { Icon } from "../icons"

/** The routes with a filtered list; filter links stay on the page they are on */
export type ListRoute = "/c/$department/$category" | "/brands/$slug" | "/$town/$store/brand" | "/search"
const FilterRoute = createContext<ListRoute | null>(null)
export const FilterRouteProvider = FilterRoute.Provider
export const useListRoute = () => useContext(FilterRoute)!

// On search, filters change while the words, tab, pack size and "as typed" stay
const SEARCH_KEEPS = ["q", "tag", "size", "exact"] as const

const withKept = (from: ListRoute, search: CategorySearch) => (from === "/search"
  ? (prev: Record<string, unknown>) => ({ ...Object.fromEntries(SEARCH_KEEPS.map((k) => [k, prev[k]])), ...search })
  : search) as never

/** A link to this page with other filters; it keeps the scroll unless it moves to another shelf */
export function FilterLink({ search, keepScroll = true, ...props }: { search: CategorySearch; keepScroll?: boolean } & Omit<ComponentProps<"a">, "href">) {
  const from = useListRoute()
  return <Link from={from} to="." params={(prev) => prev} search={withKept(from, search)} resetScroll={!keepScroll} {...props} />
}
const BRANDS_SHOWN = 8
const BRAND_FIND_FROM = 12

type Change = Partial<WebCategoryFilters>

/** The URL query for this page with some filters changed; off filters and page 1 are left out so each view has one URL */
export function categorySearch(sub: string | null, f: WebCategoryFilters, change: Change = {}): CategorySearch {
  const next = { ...f, ...change }
  return {
    sub: sub ?? undefined,
    brand: next.brand.length ? next.brand.join(",") : undefined,
    price: next.price ? formatPriceRange(next.price) : undefined,
    off: next.off ?? undefined,
    rating: next.rating ?? undefined,
    offers: next.offers ? 1 : undefined,
    food: next.food ?? undefined,
    stock: next.stock ? 1 : undefined,
    sort: next.sort === SearchSortBy.RELEVANCE ? undefined : next.sort,
  }
}

export const changed = (page: WebFilteredList) => (change: Change) => categorySearch(page.subcategory, page.filters, change)

export function priceLabel({ min, max }: PriceRange) {
  if (min === null) return `Under ${rupees(max ?? 0)}`
  if (max === null) return `${rupees(min)} & above`
  return `${rupees(min)} – ${rupees(max)}`
}

export const offLabel = (min: number) => `${min}% off or more`
export const OFFERS_LABEL = "Buy 1 Get 1 & free items"

/** How many filters are in use, for the Filters pill's badge */
export const filterCount = (f: WebCategoryFilters) =>
  f.brand.length + [f.price, f.off, f.rating, f.food].filter((v) => v !== null).length + Number(f.offers) + Number(f.stock)

function Group({ title, children, extra }: { title: string; children: ReactNode; extra?: ReactNode }) {
  return (
    <section className="border-b border-line py-4 first:pt-0 last:border-0">
      <h3 className="mb-1.5 px-2 text-[13px] font-extrabold uppercase tracking-wide text-ink">{title}</h3>
      <ul>{children}</ul>
      {extra}
    </section>
  )
}

/** A filter choice as a link, drawn as a checkbox (or a radio when the group takes one choice) */
function Option({ search, on, round = false, count, children }: {
  search: CategorySearch; on: boolean; round?: boolean; count?: number; children: ReactNode
}) {
  const box = `flex h-[18px] w-[18px] shrink-0 items-center justify-center border-2 ${round ? "rounded-full" : "rounded-[5px]"}`
  return (
    <li>
      <FilterLink search={search} aria-current={on || undefined}
        className="group flex min-h-11 items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-surface lg:min-h-9">
        <span className={`${box} ${on ? "border-brand bg-brand text-white" : "border-slate-300 bg-white group-hover:border-brand"}`}>
          {on && (round ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : <Icon name="check" size={12} />)}
        </span>
        <span className={`min-w-0 flex-1 ${on ? "font-bold text-ink" : "text-slate-700"}`}>{children}</span>
        {count !== undefined && <span className="text-xs tabular-nums text-muted">{count}</span>}
      </FilterLink>
    </li>
  )
}

function CategoryGroup({ page, allLabel }: { page: WebFilteredList; allLabel: string }) {
  if (page.subcategories.length < 2) return null
  const sort = page.filters.sort === SearchSortBy.RELEVANCE ? undefined : page.filters.sort
  const row = "flex min-h-11 items-center justify-between gap-2 rounded-lg px-2 text-sm hover:bg-surface lg:min-h-9"
  const look = (on: boolean) => (on ? "font-bold text-brand" : "text-slate-700")
  return (
    <Group title="Category">
      <li><FilterLink search={{ sort }} keepScroll={false} className={`${row} ${look(!page.subcategory)}`}>{allLabel}</FilterLink></li>
      {page.subcategories.map((s) => (
        <li key={s.slug}>
          <FilterLink search={{ sub: s.slug, sort }} keepScroll={false} className={`${row} pl-4 ${look(s.slug === page.subcategory)}`}>
            <span className="min-w-0">{s.name}</span><span className="text-xs tabular-nums text-muted">{s.count}</span>
          </FilterLink>
        </li>
      ))}
    </Group>
  )
}

function BrandGroup({ page }: { page: WebFilteredList }) {
  const [all, setAll] = useState(false)
  const [find, setFind] = useState("")
  const { brands } = page.facets
  const picked = page.filters.brand
  if (brands.length < 2 && !picked.length) return null
  const at = changed(page)
  const term = find.trim().toLowerCase()
  const shown = term ? brands.filter((b) => b.name.toLowerCase().includes(term)) : all ? brands : brands.slice(0, BRANDS_SHOWN)
  const toggle = (slug: string) => (picked.includes(slug) ? picked.filter((s) => s !== slug) : [...picked, slug])
  const more = !term && brands.length > BRANDS_SHOWN && (
    <button type="button" onClick={() => setAll(!all)} className="mt-1 flex h-9 items-center gap-1 px-2 text-sm font-bold text-brand hover:underline">
      {all ? "See fewer" : `See all ${brands.length} brands`}
      <Icon name="chevron" size={14} className={all ? "rotate-180" : ""} />
    </button>
  )
  return (
    <Group title="Brand" extra={more}>
      {brands.length > BRAND_FIND_FROM && (
        <li className="mb-1.5 px-2">
          <input type="search" value={find} onChange={(e) => setFind(e.target.value)} placeholder="Find a brand" aria-label="Find a brand"
            className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm outline-none focus:border-brand focus:bg-white" />
        </li>
      )}
      {shown.map((b) => (
        <Option key={b.slug} search={at({ brand: toggle(b.slug) })} on={picked.includes(b.slug)} count={b.count}>
          <span className="flex items-center gap-2">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-line bg-white text-[11px] font-extrabold text-muted">
              {b.imageUrl ? <img src={b.imageUrl} alt="" loading="lazy" className="h-full w-full object-contain p-0.5" /> : b.name.slice(0, 1)}
            </span>
            <span className="min-w-0">{b.name}</span>
          </span>
        </Option>
      ))}
      {term && !shown.length && <li className="px-2 py-2 text-sm text-muted">No brand matches “{find.trim()}”</li>}
    </Group>
  )
}

/** Bands sized to the category, then a min–max box for anything else */
function PriceGroup({ page }: { page: WebFilteredList }) {
  const navigate = useNavigate()
  const from = useListRoute()
  const { price } = page.filters
  const at = changed(page)
  const bands = page.facets.priceBands.filter((b) => b.count > 0 || (price && b.min === price.min && b.max === price.max))
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const value = (name: string) => (String(form.get(name) ?? "").trim() ? Math.max(0, Math.round(Number(form.get(name)))) : null)
    const [min, max] = [value("min"), value("max")]
    const range = min === null && max === null ? null : min !== null && max !== null && min > max ? { min: max, max: min } : { min, max }
    void navigate({ from, to: ".", params: (prev) => prev, search: withKept(from, at({ price: range })), resetScroll: false })
  }
  const input = "h-9 w-full min-w-0 rounded-lg border border-line bg-white px-2.5 text-sm outline-none focus:border-brand"
  const custom = (
    <form onSubmit={submit} className="mt-2 flex items-center gap-1.5 px-2" key={price ? formatPriceRange(price) : "any"}>
      <input name="min" type="number" inputMode="numeric" min={0} placeholder="₹ Min" aria-label="Minimum price" defaultValue={price?.min ?? ""} className={input} />
      <span className="text-muted">–</span>
      <input name="max" type="number" inputMode="numeric" min={0} placeholder="₹ Max" aria-label="Maximum price" defaultValue={price?.max ?? ""} className={input} />
      <button type="submit" className="h-9 shrink-0 rounded-lg border border-line bg-white px-3 text-sm font-bold hover:border-brand hover:text-brand">Go</button>
    </form>
  )
  return (
    <Group title="Price" extra={custom}>
      {bands.map((b) => {
        const on = !!price && b.min === price.min && b.max === price.max
        return <Option key={`${b.min}-${b.max}`} round search={at({ price: on ? null : { min: b.min, max: b.max } })} on={on} count={b.count}>{priceLabel(b)}</Option>
      })}
    </Group>
  )
}

function Stars({ min }: { min: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className="tracking-tight"><span className="text-amber-500">{"★".repeat(min)}</span><span className="text-slate-300">{"★".repeat(5 - min)}</span></span>
      <span>& up</span>
      <span className="sr-only">{min} stars</span>
    </span>
  )
}

function DealGroups({ page }: { page: WebFilteredList }) {
  const { facets, filters: f } = page
  const at = changed(page)
  return (
    <>
      {facets.discounts.length > 0 && (
        <Group title="Discount">
          {facets.discounts.map((d) => (
            <Option key={d.min} round search={at({ off: f.off === d.min ? null : d.min })} on={f.off === d.min} count={d.count}>{offLabel(d.min)}</Option>
          ))}
        </Group>
      )}
      {(facets.offerCount > 0 || f.offers) && (
        <Group title="Offers">
          <Option search={at({ offers: !f.offers })} on={f.offers} count={facets.offerCount}>{OFFERS_LABEL}</Option>
        </Group>
      )}
      {facets.ratings.length > 0 && (
        <Group title="Customer rating">
          {facets.ratings.map((r) => (
            <Option key={r.min} round search={at({ rating: f.rating === r.min ? null : r.min })} on={f.rating === r.min} count={r.count}><Stars min={r.min} /></Option>
          ))}
        </Group>
      )}
    </>
  )
}

function ItemGroups({ page }: { page: WebFilteredList }) {
  const { facets, filters: f } = page
  const at = changed(page)
  return (
    <>
      {(facets.foodTypes.length > 1 || f.food) && (
        <Group title="Food type">
          {facets.foodTypes.map((t) => (
            <Option key={t.type} round search={at({ food: f.food === t.type ? null : t.type })} on={f.food === t.type} count={t.count}>{FoodTypeLabels[t.type]}</Option>
          ))}
        </Group>
      )}
      {(f.stock || facets.inStockCount < page.total) && (
        <Group title="Availability">
          <Option search={at({ stock: !f.stock })} on={f.stock} count={facets.inStockCount}>In stock only</Option>
        </Group>
      )}
    </>
  )
}

/** Every filter group the list has something for, in Amazon's order; subcategories lead when given an "All …" label */
export function FilterGroups({ page, allLabel }: { page: WebFilteredList; allLabel?: string }) {
  return (
    <div>
      {allLabel && <CategoryGroup page={page} allLabel={allLabel} />}
      <BrandGroup page={page} />
      <PriceGroup page={page} />
      <DealGroups page={page} />
      <ItemGroups page={page} />
    </div>
  )
}
