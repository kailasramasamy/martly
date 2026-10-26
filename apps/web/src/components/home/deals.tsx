import { useState } from "react"
import type { WebHomeSection, WebProductCard } from "@martly/shared/types"
import { getDeals } from "~/lib/api"
import { ProductRail } from "../shelf"
import { Section, SectionHead } from "./parts"
import { ChipBar } from "./product-rows"

type Deals = Extract<WebHomeSection, { type: "PRICE_BAND_DEALS" }>
type View = { band: string; category: string; chips: Deals["chips"]; products: WebProductCard[] }

const ALL = ""

/** Price bands ("Under ₹49") and the busiest categories in the band, switched in place */
export function PriceBandDeals({ section }: { section: Deals }) {
  const [view, setView] = useState<View>({ band: section.bands[0]?.value ?? "0", category: ALL, chips: section.chips, products: section.products })
  const [busy, setBusy] = useState(false)
  const show = async (band: string, category: string) => {
    setBusy(true)
    const page = await getDeals({ data: { sectionId: section.id, band: Number(band), category: category || undefined } })
    setBusy(false)
    if (page) setView({ band, category, chips: page.chips.map((c) => ({ label: c.label, imageUrl: c.imageUrl, value: c.value })), products: page.products })
  }
  const chips = [{ key: ALL, label: "All" }, ...view.chips.map((c) => ({ key: c.value, label: c.label, imageUrl: c.imageUrl }))]
  return (
    <Section id={section.id} band="#fff7ed">
      <SectionHead id={section.id} title={section.title ?? section.headline} subtitle={section.title ? section.headline : section.subtitle} href={section.href} fallback="Deals" />
      <div role="tablist" className="mb-3 flex gap-2 overflow-x-auto [scrollbar-width:none]">
        {section.bands.map((b) => (
          <button
            key={b.value} role="tab" aria-selected={b.value === view.band} onClick={() => show(b.value, ALL)}
            className={`h-11 shrink-0 rounded-xl px-4 text-sm font-extrabold transition ${b.value === view.band ? "bg-amber text-amber-ink shadow-sm" : "bg-white text-ink hover:bg-amber/20"}`}
          >
            {b.label}
          </button>
        ))}
      </div>
      <ChipBar items={chips} active={view.category} onPick={(c) => show(view.band, c)} ink="#9a3412" />
      <div className={busy ? "opacity-50 transition" : "transition"}>
        {view.products.length ? <ProductRail products={view.products} /> : <p className="py-10 text-center text-muted">No deals in this band right now.</p>}
      </div>
    </Section>
  )
}
