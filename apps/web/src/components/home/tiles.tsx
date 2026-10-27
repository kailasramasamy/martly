import type { WebHomeSection, WebLinkTile } from "@martly/shared/types"
import { Art, PackCluster, Section, SectionHead, TileRail } from "./parts"

type Of<T> = Extract<WebHomeSection, { type: T }>

// The app's pastels: explore tiles take the next tint so neighbours never match; each store front its own paint
const TINTS = ["#ffe4d6", "#dff3e4", "#e3ebff", "#fde7f1", "#fff1bf", "#e0f2f1", "#efe5fb", "#ffe9cf"]
const PAINTS = ["#bfe3d6", "#f6c6d2", "#ffd7a3", "#c6d8f5", "#e0cdf2"]

const RAIL_ITEM = "w-[23%] shrink-0 snap-start sm:w-auto"

function SquareTile({ tile, className = "bg-brand-tint hover:bg-teal-100", item = RAIL_ITEM }: { tile: WebLinkTile; className?: string; item?: string }) {
  return (
    <li className={item}>
      <a href={tile.href} className={`group block h-full rounded-2xl px-1.5 pb-2.5 pt-1.5 text-center ${className}`}>
        <Art src={tile.imageUrl} className="aspect-square w-full transition group-hover:scale-105" />
        <span className="mt-1 block text-[11px] font-bold leading-tight sm:text-[13px]">{tile.label}</span>
      </a>
    </li>
  )
}

export function DepartmentGrid({ section }: { section: Of<"DEPARTMENT_GRID"> }) {
  return (
    <Section id={section.id}>
      <SectionHead id={section.id} title={section.title ?? "Shop by department"} subtitle={section.subtitle} fallback="Departments" />
      <ul className="-mx-4 grid auto-cols-[23%] grid-flow-col grid-rows-2 gap-2.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:auto-cols-auto sm:grid-flow-row sm:grid-cols-6 sm:grid-rows-none sm:gap-3 sm:px-0 lg:grid-cols-8">
        {section.tiles.map((t) => <SquareTile key={t.href} tile={t} item="" />)}
      </ul>
    </Section>
  )
}

export function CategoryDirectory({ section }: { section: Of<"CATEGORY_DIRECTORY"> }) {
  return (
    <Section id={section.id}>
      <SectionHead id={section.id} title={section.title} subtitle={section.subtitle} href={section.href} fallback="All categories" />
      <div className="space-y-6">
        {section.groups.map((g) => (
          <div key={g.href}>
            <h3 className="mb-2.5 text-base font-extrabold"><a href={g.href} className="hover:text-brand">{g.label}</a></h3>
            <TileRail cols="sm:grid-cols-6 lg:grid-cols-8">{g.tiles.map((t) => <SquareTile key={t.href} tile={t} className="bg-surface hover:bg-brand-tint" />)}</TileRail>
          </div>
        ))}
      </div>
    </Section>
  )
}

export function BestsellerCategories({ section }: { section: Of<"BESTSELLER_CATEGORIES"> }) {
  return (
    <Section id={section.id}>
      <SectionHead id={section.id} title={section.title ?? "Bestsellers"} subtitle={section.subtitle} fallback="Bestsellers" />
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-6 sm:gap-4">
        {section.categories.map((c) => (
          <li key={c.href}>
            <a href={c.href} className="block h-full rounded-2xl bg-[#e8f1f1] p-2 pb-2.5 hover:bg-teal-100">
              <span className="relative mb-3.5 block">
                <PackCluster images={c.images} />
                {c.more > 0 && (
                  <span className="absolute inset-x-0 -bottom-2.5 mx-auto w-fit rounded-full border border-line bg-surface px-2 text-[11px] font-semibold leading-5 text-muted">+{c.more} more</span>
                )}
              </span>
              <span className="line-clamp-2 block text-center text-[13px] font-bold leading-4">{c.label}</span>
            </a>
          </li>
        ))}
      </ul>
    </Section>
  )
}

/** A pastel band: its headline and art, then its aisles; on wide screens the headline sits beside them */
export function ThemeBand({ section }: { section: Of<"THEME_BAND"> }) {
  return (
    <Section id={section.id} band={section.tint} className="lg:flex lg:items-center lg:gap-8">
      <div className="mb-4 flex items-center gap-3 lg:mb-0 lg:w-64 lg:shrink-0 lg:flex-col lg:items-start">
        <div className="min-w-0 flex-1 lg:flex-none">
          <h2 id={`s-${section.id}`} className="text-xl font-extrabold tracking-tight sm:text-2xl">{section.title}</h2>
          {section.subtitle && <p className="mt-1 text-sm font-medium text-muted">{section.subtitle}</p>}
        </div>
        {section.imageUrl && <img src={section.imageUrl} alt="" loading="lazy" className="-my-2 h-20 w-24 object-contain sm:h-24 sm:w-32 lg:my-0 lg:h-36 lg:w-44" />}
      </div>
      <div className="min-w-0 flex-1">
        <TileRail cols="sm:grid-cols-4">
          {section.tiles.map((t) => (
            <li key={t.href} className="w-[28%] shrink-0 snap-start sm:w-auto">
              <a href={t.href} className="group block text-center">
                <Art src={t.imageUrl} className="aspect-[4/5] w-full rounded-2xl bg-white/60 p-1 transition group-hover:bg-white" />
                <span className="mt-1.5 line-clamp-2 block text-[13px] font-semibold leading-4">{t.label}</span>
              </a>
            </li>
          ))}
        </TileRail>
      </div>
    </Section>
  )
}

function TileArt({ tile, className }: { tile: Of<"EXPLORE_GRID" | "STORE_GRID">["tiles"][number]; className: string }) {
  if (tile.imageUrl) return <img src={tile.imageUrl} alt="" loading="lazy" className={`object-contain ${className}`} />
  return <PackCluster images={tile.packImages} className={className} />
}

function Awning({ paint }: { paint: string }) {
  return (
    <span aria-hidden="true" className="block h-6" style={{
      background: `repeating-linear-gradient(90deg, color-mix(in srgb, ${paint} 90%, black) 0 22px, color-mix(in srgb, ${paint} 40%, white) 22px 44px)`,
      WebkitMask: "radial-gradient(circle at 11px 13px, #000 11px, transparent 11.5px) 0 0 / 22px 100% repeat-x, linear-gradient(#000 0 13px, transparent 13px)",
    }} />
  )
}

/** "Explore by mood" pastel tiles, and "Shop by store" fronts under striped awnings; wide tiles span two columns */
export function TileGrid({ section }: { section: Of<"EXPLORE_GRID" | "STORE_GRID"> }) {
  const store = section.type === "STORE_GRID"
  return (
    <Section id={section.id} band={store ? "#eef4f3" : "#faf6ee"}>
      <SectionHead id={section.id} title={section.title} subtitle={section.subtitle} fallback={store ? "Shop by store" : "Explore"} />
      <ul className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-4 lg:grid-cols-6">
        {section.tiles.map((t, i) => (
          <li key={t.href} className={t.wide ? "col-span-2" : ""}>
            <a
              href={t.href}
              className="relative flex h-28 flex-col overflow-hidden rounded-2xl transition hover:brightness-[0.97] sm:h-36"
              style={{ background: store ? PAINTS[i % PAINTS.length] : TINTS[i % TINTS.length] }}
            >
              {store && <Awning paint={PAINTS[i % PAINTS.length]} />}
              <span className={`relative z-10 px-3 text-[13px] font-extrabold leading-4 sm:text-[15px] sm:leading-5 ${store ? "pt-1" : "pt-3"} ${t.wide ? "w-3/5" : ""}`}>{t.label}</span>
              <TileArt tile={t} className={`absolute bottom-1 right-1 ${t.wide ? "h-24 w-24 sm:h-28 sm:w-28" : "h-16 w-16 sm:h-20 sm:w-20"}`} />
            </a>
          </li>
        ))}
      </ul>
    </Section>
  )
}

export function BrandRail({ section }: { section: Of<"BRAND_RAIL"> }) {
  return (
    <Section id={section.id}>
      <SectionHead id={section.id} title={section.title ?? "Shop by brand"} subtitle={section.subtitle} href="/brands" fallback="Brands" />
      <TileRail cols="sm:grid-cols-6 lg:grid-cols-12">
        {section.brands.map((b) => (
          <li key={b.href} className="w-[22%] shrink-0 snap-start sm:w-auto">
            <a href={b.href} className="group block text-center">
              <span className="block aspect-square rounded-full border-2 bg-white p-2.5 transition group-hover:shadow-md" style={{ borderColor: b.themeColor ?? "#e2e8f0" }}>
                <Art src={b.imageUrl} alt="" className="h-full w-full rounded-full" />
              </span>
              <span className="mt-1.5 line-clamp-1 block text-xs font-bold">{b.label}</span>
            </a>
          </li>
        ))}
      </TileRail>
    </Section>
  )
}
