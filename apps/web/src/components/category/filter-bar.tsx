import type { ReactNode } from "react"
import { FoodTypeLabels, SearchSortBy, SearchSortLabels } from "@martly/shared/constants"
import type { WebFilteredList } from "@martly/shared/types"
import type { CategorySearch } from "~/lib/api"
import { Icon } from "../icons"
import { Menu } from "../search/filters"
import { changed, filterCount, FilterGroups, FilterLink, OFFERS_LABEL, offLabel, priceLabel, useListRoute } from "./filter-rail"

// Lists open popular first; search opens on relevance
const LIST_SORT_LABELS: Record<SearchSortBy, string> = { ...SearchSortLabels, [SearchSortBy.RELEVANCE]: "Popular" }

const clearAll = (page: WebFilteredList): CategorySearch => ({
  sub: page.subcategory ?? undefined,
  sort: page.filters.sort === SearchSortBy.RELEVANCE ? undefined : page.filters.sort,
})

/** Each filter in use as a removable chip */
function appliedChips(page: WebFilteredList): { key: string; label: string; search: CategorySearch }[] {
  const f = page.filters
  const at = changed(page)
  const brandName = (slug: string) => page.facets.brands.find((b) => b.slug === slug)?.name ?? slug
  return [
    ...f.brand.map((slug) => ({ key: `b-${slug}`, label: brandName(slug), search: at({ brand: f.brand.filter((s) => s !== slug) }) })),
    ...(f.price ? [{ key: "price", label: priceLabel(f.price), search: at({ price: null }) }] : []),
    ...(f.off !== null ? [{ key: "off", label: offLabel(f.off), search: at({ off: null }) }] : []),
    ...(f.offers ? [{ key: "offers", label: OFFERS_LABEL, search: at({ offers: false }) }] : []),
    ...(f.rating !== null ? [{ key: "rating", label: `${f.rating}★ & up`, search: at({ rating: null }) }] : []),
    ...(f.food ? [{ key: "food", label: FoodTypeLabels[f.food], search: at({ food: null }) }] : []),
    ...(f.stock ? [{ key: "stock", label: "In stock only", search: at({ stock: false }) }] : []),
  ]
}

function SortMenu({ page }: { page: WebFilteredList }) {
  const at = changed(page)
  const { sort } = page.filters
  const labels = useListRoute() === "/search" ? SearchSortLabels : LIST_SORT_LABELS
  return (
    <Menu label={`Sort: ${labels[sort]}`} active={sort !== SearchSortBy.RELEVANCE} align="right">
      {(close) => (
        <ul>
          {Object.values(SearchSortBy).map((s) => (
            <li key={s}>
              <FilterLink search={at({ sort: s })} keepScroll={false} onClick={close}
                className={`flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 text-[15px] font-semibold hover:bg-surface ${s === sort ? "text-brand" : ""}`}>
                {labels[s]}
                {s === sort && <Icon name="check" size={18} />}
              </FilterLink>
            </li>
          ))}
        </ul>
      )}
    </Menu>
  )
}

/** Below the wide screens' rail: the same groups in a sheet; each pick applies at once and the counts follow */
function FilterSheet({ page }: { page: WebFilteredList }) {
  const count = filterCount(page.filters)
  return (
    <div className="lg:hidden">
      <Menu label="Filters" icon="sliders" active={count > 0} badge={count}>
        {(close) => (
          <div>
            <FilterGroups page={page} />
            <div className="sticky -bottom-6 -mx-4 mt-2 flex gap-3 border-t border-line bg-white px-4 pb-6 pt-3 sm:-bottom-4 sm:pb-4">
              <FilterLink search={clearAll(page)} className="flex h-11 flex-1 items-center justify-center rounded-full border border-line text-sm font-bold hover:border-brand">Clear all</FilterLink>
              <button type="button" onClick={close} className="h-11 flex-1 rounded-full bg-brand text-sm font-bold text-white hover:bg-brand-deep">
                Show {page.total} {page.total === 1 ? "product" : "products"}
              </button>
            </div>
          </div>
        )}
      </Menu>
    </div>
  )
}

/** The count, any extra controls, Filters (below wide screens) and Sort, then the filters in use as chips */
export function FilterBar({ page, extra }: { page: WebFilteredList; extra?: ReactNode }) {
  const chips = appliedChips(page)
  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="order-last w-full text-sm text-muted sm:order-none sm:w-auto"><b className="text-ink">{page.total.toLocaleString("en-IN")}</b> {page.total === 1 ? "product" : "products"}</p>
        <div className="flex gap-2">
          {extra}
          <FilterSheet page={page} />
          <SortMenu page={page} />
        </div>
      </div>
      {chips.length > 0 && (
        <ul className="mt-3 flex flex-wrap items-center gap-2">
          {chips.map((c) => (
            <li key={c.key}>
              <FilterLink search={c.search} aria-label={`Remove ${c.label}`}
                className="flex h-9 items-center gap-1 rounded-full border border-brand bg-brand-tint pl-3 pr-2 text-sm font-bold text-brand hover:bg-white">
                {c.label} <Icon name="close" size={14} />
              </FilterLink>
            </li>
          ))}
          <li><FilterLink search={clearAll(page)} className="px-2 text-sm font-bold text-brand hover:underline">Clear all</FilterLink></li>
        </ul>
      )}
    </div>
  )
}
