import type { WebBrandPage } from "@martly/shared/types"
import { Breadcrumbs } from "./shop-layout"
import { FilteredListView } from "./category/filtered-list"
import type { ListRoute } from "./category/filter-rail"

/** A brand's store: its logo and name, then its products with subcategory chips and the category filters */
export function BrandListing({ page, route, base }: { page: WebBrandPage; route: ListRoute; base: string }) {
  const total = page.subcategories.reduce((sum, s) => sum + s.count, 0)
  return (
    <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
      <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: "Brands", path: "/brands" }, { name: page.brand.name }]} />
      <div className="mt-3 flex items-center gap-4">
        {page.brand.imageUrl && <img src={page.brand.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded-full border border-line bg-white object-contain p-2" />}
        <div className="min-w-0">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{page.brand.name}</h1>
          <p className="mt-1 text-sm text-muted">{total} products at {page.store.name}</p>
        </div>
      </div>
      <FilteredListView list={page} route={route} base={base} empty={`No ${page.brand.name} products at ${page.store.name} right now.`} />
    </div>
  )
}
