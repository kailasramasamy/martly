import type { ReactNode } from "react"
import { useLoaderData } from "@tanstack/react-router"
import type { WebShopStore } from "@martly/shared/types"
import { SiteHeader } from "./site-header"
import { SiteFooter } from "./site-footer"
import { DepartmentBar } from "./department-bar"

/** Live towns from the root loader */
export const useTowns = () => useLoaderData({ from: "__root__" }).towns

/** Header with the shopper's store, the store's departments (Home has its own tiles), the page, and the footer */
export function ShopLayout({ store, q, departments = true, children }: { store: WebShopStore | null; q?: string; departments?: boolean; children: ReactNode }) {
  const towns = useTowns()
  return (
    <>
      <SiteHeader store={store} towns={towns} q={q} />
      {store && departments && <DepartmentBar />}
      <main className="pb-24">{children}</main>
      <SiteFooter towns={towns} />
    </>
  )
}

export function Breadcrumbs({ items }: { items: { name: string; path?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-muted">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((item, i) => (
          <li key={item.name} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden="true">/</span>}
            {item.path ? <a href={item.path} className="hover:text-brand">{item.name}</a> : <span aria-current="page" className="font-semibold text-ink">{item.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  )
}
