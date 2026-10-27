import type { ReactNode } from "react"
import type { WebFilterLink, WebListPage } from "@martly/shared/types"
import { Breadcrumbs, ShopLayout } from "./shop-layout"
import { ProductGrid } from "./product-card"

type Params = Record<string, string | number | undefined>

/** A link to a list with these filters, dropping empty ones and page 1 so each list has one URL */
export function listHref(base: string, params: Params) {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "" || (key === "page" && Number(value) <= 1)) continue
    query.set(key, String(value))
  }
  const q = query.toString()
  return q ? `${base}?${q}` : base
}

/** Reads a page number from the URL; page 1 is left out */
export const pageParam = (value: unknown) => (Number(value) > 1 ? Math.floor(Number(value)) : undefined)
export const textParam = (value: unknown) => (typeof value === "string" && value ? value : undefined)
export const oneOf = <T extends string>(values: Record<string, T>, value: unknown) =>
  (Object.values(values) as unknown[]).includes(value) ? (value as T) : undefined
// The router runs validateSearch on what it read from the URL ("1") and again on its own output (1)
export const flag = (value: unknown) => (value === "1" || value === 1 ? (1 as const) : undefined)

export function Pager({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null
  const link = "flex h-11 items-center rounded-full border border-line px-5 text-sm font-bold hover:border-brand hover:text-brand"
  return (
    <nav aria-label="Pages" className="mt-10 flex items-center justify-center gap-3">
      {page > 1 && <a rel="prev" href={href(page - 1)} className={link}>Previous</a>}
      <span className="text-sm font-semibold text-muted">Page {page} of {totalPages}</span>
      {page < totalPages && <a rel="next" href={href(page + 1)} className={link}>Next</a>}
    </nav>
  )
}

/** Filter links as chips; the active one is filled */
export function FilterChips({ items, all }: { items: Pick<WebFilterLink, "label" | "href" | "active" | "imageUrl">[]; all?: string }) {
  if (!items.length) return null
  const chip = "flex h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-4 text-sm font-bold"
  const on = "border-brand bg-brand text-white"
  const off = "border-line bg-white hover:border-brand hover:text-brand"
  return (
    <ul className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {all && <li className="shrink-0"><a href={all} className={`${chip} ${items.some((i) => i.active) ? off : on}`}>All</a></li>}
      {items.map((i) => (
        <li key={i.href} className="shrink-0">
          <a href={i.href} className={`${chip} ${i.active ? on : off}`}>
            {i.imageUrl && <img src={i.imageUrl} alt="" className="h-6 w-6 rounded-full bg-white object-contain" />}
            {i.label}
          </a>
        </li>
      ))}
    </ul>
  )
}

/** A full list behind a Home row: title, filters, a grid of products and the pager */
export function ListPageView({ page, crumb, base, params, header, empty }: {
  page: WebListPage; crumb: string; base: string; params: Params; header?: ReactNode; empty: string
}) {
  return (
    <ShopLayout store={page.store}>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <Breadcrumbs items={[{ name: "Home", path: "/" }, { name: crumb }]} />
        <div className="mt-3 flex items-center gap-4">
          {header}
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{page.title}</h1>
            {page.subtitle && <p className="mt-1 text-muted">{page.subtitle}</p>}
          </div>
        </div>
        {page.bands && <FilterChips items={page.bands} />}
        <FilterChips items={page.chips} all={listHref(base, { ...params, category: undefined, page: undefined })} />
        <div className="mt-6">
          {page.products.length ? <ProductGrid products={page.products} /> : <p className="py-16 text-center text-muted">{empty}</p>}
        </div>
        <Pager page={page.page} totalPages={page.totalPages} href={(n) => listHref(base, { ...params, page: n })} />
      </div>
    </ShopLayout>
  )
}
