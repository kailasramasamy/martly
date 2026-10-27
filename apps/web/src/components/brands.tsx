import { useMemo, useState } from "react"
import type { WebBrandsPage, WebBrandTile } from "@martly/shared/types"
import { Icon } from "./icons"
import { Art } from "./home/parts"

const brandHref = (slug: string) => `/brands/${slug}`

/** A–Z, with names that start with a digit or symbol under "#" */
const letterOf = (name: string) => {
  const first = name.trim().charAt(0).toUpperCase()
  return first >= "A" && first <= "Z" ? first : "#"
}

function group(brands: WebBrandTile[]) {
  const groups = new Map<string, WebBrandTile[]>()
  for (const b of brands) {
    const letter = letterOf(b.name)
    groups.set(letter, [...(groups.get(letter) ?? []), b])
  }
  return [...groups].sort(([a], [b]) => (a === "#" ? 1 : b === "#" ? -1 : a.localeCompare(b)))
}

function Logo({ brand, className }: { brand: WebBrandTile; className: string }) {
  return (
    <span className={`block shrink-0 rounded-full border-2 bg-white p-2 ${className}`} style={{ borderColor: brand.themeColor ?? "#e2e8f0" }}>
      <Art src={brand.imageUrl} alt="" className="h-full w-full rounded-full" />
    </span>
  )
}

export function PopularBrands({ brands }: { brands: WebBrandTile[] }) {
  if (!brands.length) return null
  return (
    <section aria-labelledby="popular-brands" className="mt-8">
      <h2 id="popular-brands" className="text-xl font-extrabold tracking-tight sm:text-2xl">Popular brands</h2>
      <ul className="mt-4 flex snap-x gap-3 overflow-x-auto pb-2 sm:grid sm:grid-cols-6 sm:overflow-visible lg:grid-cols-12">
        {brands.map((b) => (
          <li key={b.slug} className="w-[22%] shrink-0 snap-start sm:w-auto">
            <a href={brandHref(b.slug)} className="group block text-center">
              <Logo brand={b} className="aspect-square w-full transition group-hover:shadow-md" />
              <span className="mt-1.5 line-clamp-1 block text-xs font-bold">{b.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Filters({ page, q, setQ, department, setDepartment }: {
  page: WebBrandsPage; q: string; setQ: (q: string) => void; department: string | null; setDepartment: (d: string | null) => void
}) {
  const chip = (active: boolean) =>
    `flex h-11 items-center whitespace-nowrap rounded-full border px-4 text-sm font-bold ${active ? "border-brand bg-brand-tint text-brand" : "border-line hover:border-brand hover:text-brand"}`
  return (
    <div className="mt-8 space-y-3">
      <label className="flex h-11 max-w-md items-center gap-2 rounded-full border border-line bg-surface px-4 focus-within:border-brand focus-within:bg-white">
        <Icon name="search" size={18} className="shrink-0 text-muted" />
        <input
          value={q} type="search" autoComplete="off" placeholder="Find a brand" aria-label="Find a brand"
          onChange={(e) => setQ(e.target.value)} className="w-full bg-transparent text-[15px] outline-none placeholder:text-slate-400"
        />
      </label>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        <li className="shrink-0"><button type="button" onClick={() => setDepartment(null)} className={chip(!department)}>All</button></li>
        {page.departments.map((d) => (
          <li key={d.slug} className="shrink-0">
            <button type="button" aria-pressed={department === d.slug} onClick={() => setDepartment(department === d.slug ? null : d.slug)} className={chip(department === d.slug)}>{d.name}</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LetterGroups({ groups }: { groups: [string, WebBrandTile[]][] }) {
  return (
    <>
      <nav aria-label="Brands by letter" className="mt-6 flex flex-wrap gap-1">
        {groups.map(([letter]) => (
          <a key={letter} href={`#letter-${letter}`} className="flex h-9 w-9 items-center justify-center rounded-lg text-sm font-extrabold text-brand hover:bg-brand-tint">{letter}</a>
        ))}
      </nav>
      {groups.map(([letter, brands]) => (
        <section key={letter} id={`letter-${letter}`} aria-label={letter} className="mt-6 scroll-mt-32">
          <h2 className="border-b border-line pb-1 text-lg font-extrabold">{letter}</h2>
          <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            {brands.map((b) => (
              <li key={b.slug}>
                <a href={brandHref(b.slug)} className="flex min-h-14 items-center gap-3 rounded-xl border border-line bg-white p-2 transition hover:border-brand hover:shadow-sm">
                  <Logo brand={b} className="h-11 w-11" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 block text-sm font-bold leading-tight">{b.name}</span>
                    <span className="block text-xs text-muted">{b.productCount} {b.productCount === 1 ? "product" : "products"}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}

/** The store's brands: the best known up top, then all of them A to Z, narrowed as the shopper types or picks a department */
export function BrandDirectory({ page }: { page: WebBrandsPage }) {
  const [q, setQ] = useState("")
  const [department, setDepartment] = useState<string | null>(null)
  const bySlug = useMemo(() => new Map(page.brands.map((b) => [b.slug, b])), [page.brands])
  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return group(page.brands.filter((b) => (!needle || b.name.toLowerCase().includes(needle)) && (!department || b.departments.includes(department))))
  }, [page.brands, q, department])
  const filtering = q.trim() !== "" || department !== null
  return (
    <>
      {!filtering && <PopularBrands brands={page.popular.flatMap((slug) => bySlug.get(slug) ?? [])} />}
      <Filters page={page} q={q} setQ={setQ} department={department} setDepartment={setDepartment} />
      {groups.length ? <LetterGroups groups={groups} /> : <p className="mt-8 text-sm text-muted">No brand at {page.store.name} matches that.</p>}
    </>
  )
}
