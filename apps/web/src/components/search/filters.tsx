import { useEffect, useRef, useState, type ReactNode } from "react"
import { Link } from "@tanstack/react-router"
import type { WebSearchFacets, WebSearchFilters } from "@martly/shared/types"
import type { SearchParams } from "~/lib/api"
import { Icon } from "../icons"
import { categorySearch } from "../category/filter-rail"

export type SearchQuery = Partial<SearchParams>

/** The URL for a search with these filters changed; defaults are left out so each search has one URL */
export function searchFor(q: string, f: WebSearchFilters, change: Partial<WebSearchFilters> = {}): SearchQuery {
  const next = { ...f, ...change }
  return { q, ...categorySearch(next.sub ?? null, next), tag: next.tag, size: next.size, exact: next.exact ? 1 : undefined }
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

/** The pack size picker; the other filters live in the sidebar (a sheet on narrow screens) */
export function SizeMenu({ q, filters, facets }: { q: string; filters: WebSearchFilters; facets: WebSearchFacets }) {
  if (!facets.sizes.length && !filters.size) return null
  const sizes = [
    { label: "Any size", search: searchFor(q, filters, { size: undefined }), on: !filters.size },
    ...facets.sizes.map((s) => ({ label: s.label, note: String(s.count), search: searchFor(q, filters, { size: s.label }), on: filters.size === s.label })),
  ]
  return <Menu label={filters.size ?? "Size"} active={!!filters.size}>{(close) => <Choices items={sizes} close={close} />}</Menu>
}
