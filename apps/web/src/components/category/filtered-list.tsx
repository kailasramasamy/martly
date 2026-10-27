import { DISCOUNT_TIERS, FoodType, RATING_TIERS, SearchSortBy } from "@martly/shared/constants"
import type { WebFilteredList } from "@martly/shared/types"
import type { CategorySearch } from "~/lib/api"
import { ProductGrid } from "../product-card"
import { flag, listHref, oneOf, pageParam, Pager, textParam } from "../list-page"
import { FilterBar } from "./filter-bar"
import { categorySearch, filterCount, FilterGroups, FilterLink, FilterRouteProvider, type ListRoute } from "./filter-rail"

const tier = (tiers: readonly number[], value: unknown) => (tiers.includes(Number(value)) ? Number(value) : undefined)

/** A filtered list's URL query, as the router reads it (idempotent: it runs on the URL and again on its own output) */
export function listSearch(search: Record<string, unknown>): CategorySearch {
  return {
    sub: textParam(search.sub),
    brand: textParam(search.brand),
    price: textParam(search.price),
    off: tier(DISCOUNT_TIERS, search.off),
    rating: tier(RATING_TIERS, search.rating),
    offers: flag(search.offers),
    food: oneOf(FoodType, search.food),
    stock: flag(search.stock),
    sort: oneOf(SearchSortBy, search.sort),
    page: pageParam(search.page),
  }
}

/** A filtered or sorted view is the same shelf again, so only the plain list and its subcategories are indexed */
export const isFilteredView = (list: WebFilteredList) => filterCount(list.filters) > 0 || list.filters.sort !== SearchSortBy.RELEVANCE

function SubcategoryChips({ list, wideToo }: { list: WebFilteredList; wideToo: boolean }) {
  if (list.subcategories.length < 2) return null
  const chip = "flex h-11 shrink-0 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold"
  const on = "border-brand bg-brand text-white"
  const off = "border-line bg-white hover:border-brand hover:text-brand"
  const sort = list.filters.sort === SearchSortBy.RELEVANCE ? undefined : list.filters.sort
  return (
    <ul className={`-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 ${wideToo ? "" : "lg:hidden"}`}>
      <li><FilterLink search={{ sort }} keepScroll={false} className={`${chip} ${list.subcategory ? off : on}`}>All</FilterLink></li>
      {list.subcategories.map((s) => (
        <li key={s.slug}>
          <FilterLink search={{ sub: s.slug, sort }} keepScroll={false} className={`${chip} ${s.slug === list.subcategory ? on : off}`}>
            {s.name} <span className="ml-1.5 font-semibold opacity-70">{s.count}</span>
          </FilterLink>
        </li>
      ))}
    </ul>
  )
}

/**
 * Subcategory chips, the filter rail on wide screens (a sheet below them), the count, sort and chips, the grid and the pager.
 * With an "All …" label the subcategories move into the rail on wide screens, as on a category page; without, the chips stay on top.
 */
export function FilteredListView({ list, route, base, allLabel, empty }: {
  list: WebFilteredList; route: ListRoute; base: string; allLabel?: string; empty: string
}) {
  return (
    <FilterRouteProvider value={route}>
      <SubcategoryChips list={list} wideToo={!allLabel} />
      <div className="mt-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-8">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pb-6 pr-1 [scrollbar-width:thin]">
            <FilterGroups page={list} allLabel={allLabel} />
          </div>
        </aside>
        <div className="min-w-0">
          <FilterBar page={list} />
          {list.products.length
            ? <ProductGrid products={list.products} beside />
            : <p className="py-16 text-center text-muted">{filterCount(list.filters) > 0 ? "Nothing matches these filters. Try removing one." : empty}</p>}
          <Pager page={list.page} totalPages={list.totalPages} href={(n) => listHref(base, { ...categorySearch(list.subcategory, list.filters), page: n })} />
        </div>
      </div>
    </FilterRouteProvider>
  )
}
