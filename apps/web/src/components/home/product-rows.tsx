import { useState } from "react"
import type { WebHomeSection, WebProductCard } from "@martly/shared/types"
import { getCollection } from "~/lib/api"
import { ProductRail, SeeAll } from "../shelf"
import { Art, Section, SectionHead } from "./parts"

type Of<T> = Extract<WebHomeSection, { type: T }>

/** A row of products under one of the app's three header looks: plain, a tinted banner with art, or full artwork */
export function ProductRow({ section }: { section: Of<"PRODUCT_ROW"> }) {
  const { header } = section
  if (header.style === "PLAIN" || !header.imageUrl) {
    return (
      <Section id={section.id}>
        <SectionHead id={section.id} title={section.title} subtitle={section.subtitle} href={section.href} fallback="Products" />
        <ProductRail products={section.products} />
      </Section>
    )
  }
  const artwork = header.style === "ARTWORK"
  return (
    <Section id={section.id}>
      <div className={`mb-4 flex overflow-hidden rounded-2xl ${artwork ? "flex-col sm:flex-row sm:items-center" : "items-center pl-4 sm:pl-6"}`} style={{ background: header.tint ?? "#f0fdfa" }}>
        <div className={`min-w-0 flex-1 ${artwork ? "order-2 p-4 text-center sm:order-1 sm:p-8 sm:text-left" : "py-3"}`}>
          <h2 id={`s-${section.id}`} className={`font-extrabold tracking-tight ${artwork ? "text-2xl text-brand-deep sm:text-3xl" : "text-xl sm:text-2xl"}`}>{section.title}</h2>
          {section.subtitle && <p className="mt-1 text-sm font-medium text-muted">{section.subtitle}</p>}
          {section.href && <SeeAll href={section.href} className={`mt-3 text-brand hover:text-brand-deep ${artwork ? "justify-center sm:justify-start" : ""}`} />}
        </div>
        <img src={header.imageUrl} alt="" loading="lazy" className={artwork ? "order-1 aspect-[2/1] w-full object-cover sm:order-2 sm:w-1/2" : "mr-2 h-24 w-24 shrink-0 object-contain sm:h-32 sm:w-32"} />
      </div>
      <ProductRail products={section.products} />
    </Section>
  )
}

export function BrandCard({ section }: { section: Of<"BRAND_CARD"> }) {
  const ink = section.brand.themeColor ?? "#0f172a"
  return (
    <section aria-labelledby={`s-${section.id}`} className="mx-auto mt-10 max-w-7xl px-2 sm:px-4">
      <div className="rounded-[20px] p-2 sm:p-4" style={{ background: section.tint ?? "#f8fafc" }}>
        <div className="flex items-center gap-3 p-2">
          <Art src={section.brand.logoUrl} className="h-14 w-14 shrink-0 rounded-full bg-white p-2 shadow-md" />
          <div className="min-w-0 flex-1">
            <h2 id={`s-${section.id}`} className="text-xl font-extrabold tracking-tight" style={{ color: ink }}>{section.title ?? section.brand.name}</h2>
            {section.subtitle && <p className="text-[13px] font-semibold opacity-85" style={{ color: ink }}>{section.subtitle}</p>}
          </div>
          {section.imageUrl && <img src={section.imageUrl} alt="" loading="lazy" className="hidden h-20 w-20 object-contain sm:block" />}
        </div>
        <div className="px-2 pt-2"><ProductRail products={section.products} /></div>
        {section.href && (
          <a href={section.href} className="mx-auto mt-2 flex min-h-11 w-fit items-center rounded-full px-7 text-sm font-extrabold text-white hover:opacity-90" style={{ background: ink }}>
            Shop all {section.brand.name}
          </a>
        )}
      </div>
    </section>
  )
}

export function OfferRow({ section }: { section: Of<"BUY_GET_DEALS" | "DEALS"> }) {
  const fallback = section.type === "BUY_GET_DEALS" ? "Buy more, get more free" : "Today's deals"
  return (
    <Section id={section.id}>
      <SectionHead id={section.id} title={section.title ?? fallback} subtitle={section.subtitle} href={section.href} fallback={fallback} />
      <ProductRail products={section.products} />
    </Section>
  )
}

/** Chips that switch what the row below shows; the active one is filled */
export function ChipBar({ items, active, onPick, ink = "#0f766e" }: {
  items: { key: string; label: string; imageUrl?: string | null }[]; active: string; onPick: (key: string) => void; ink?: string
}) {
  return (
    <div role="tablist" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
      {items.map((it) => {
        const on = it.key === active
        return (
          <button
            key={it.key} role="tab" aria-selected={on} onClick={() => onPick(it.key)}
            className="flex h-10 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 text-sm font-bold transition"
            style={on ? { background: ink, borderColor: ink, color: "#fff" } : { borderColor: "#e2e8f0", background: "#fff" }}
          >
            {it.imageUrl && <img src={it.imageUrl} alt="" className="h-6 w-6 rounded-full bg-white object-contain" />}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}

const DAY_PART_TITLE = { morning: "Picked for this morning", afternoon: "Picked for this afternoon", evening: "Picked for this evening", night: "Picked for tonight" }

export function TimePicks({ section }: { section: Of<"TIME_PICKS"> }) {
  const [active, setActive] = useState(section.categories[0]?.href ?? "")
  const current = section.categories.find((c) => c.href === active) ?? section.categories[0]
  if (!current) return null
  return (
    <Section id={section.id}>
      <SectionHead id={section.id} title={section.title ?? DAY_PART_TITLE[section.dayPart]} subtitle={section.subtitle} href={current.href} fallback="Picks" />
      <ChipBar items={section.categories.map((c) => ({ key: c.href, label: c.label, imageUrl: c.imageUrl }))} active={current.href} onPick={setActive} />
      <ProductRail products={current.products} />
    </Section>
  )
}

/** Tabs of collections; the first comes with the page, the others load once when picked */
export function TabbedRow({ section }: { section: Of<"TABBED_ROW"> }) {
  const first = section.tabs[0]
  const [active, setActive] = useState(first?.slug ?? "")
  const [loaded, setLoaded] = useState<Record<string, WebProductCard[]>>(first ? { [first.slug]: section.products } : {})
  const pick = async (slug: string) => {
    setActive(slug)
    if (loaded[slug]) return
    const page = await getCollection({ data: { slug } })
    setLoaded((all) => ({ ...all, [slug]: page?.products ?? [] }))
  }
  const tab = section.tabs.find((t) => t.slug === active) ?? first
  if (!tab) return null
  const products = loaded[tab.slug]
  return (
    <Section id={section.id} band={section.tint ?? undefined}>
      <SectionHead id={section.id} title={section.title} subtitle={section.subtitle} href={tab.href} fallback="Collections" />
      <ChipBar items={section.tabs.map((t) => ({ key: t.slug, label: t.label, imageUrl: t.imageUrl }))} active={tab.slug} onPick={pick} />
      {products ? <ProductRail products={products} /> : <div className="h-[340px] animate-pulse rounded-2xl bg-white/60" />}
    </Section>
  )
}
