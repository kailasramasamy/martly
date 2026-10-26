import { useEffect, useState } from "react"
import type { WebHomeSection } from "@martly/shared/types"
import { ProductRail } from "../shelf"
import { Icon } from "../icons"
import { PackCluster, Section, SectionHead } from "./parts"

type Of<T> = Extract<WebHomeSection, { type: T }>

const HOUR = 3_600_000

/** "Ends in 3 days" / "Ends in 5 hours"; drawn after load so the server's clock never disagrees with the shopper's */
export function Countdown({ endsAt, ink }: { endsAt: string; ink: string }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(timer)
  }, [])
  if (now === null) return null
  const left = new Date(endsAt).getTime() - now
  if (left <= 0) return null
  const days = Math.floor(left / (24 * HOUR))
  const text = days >= 1 ? `${days} day${days > 1 ? "s" : ""}` : `${Math.max(1, Math.floor(left / HOUR))} hours`
  return <span className="rounded-full border px-2.5 py-1 text-xs font-bold" style={{ borderColor: `${ink}40`, color: ink }}>Ends in {text}</span>
}

/** Three standout products fanned like cards in a hand */
function HighlightFan({ images }: { images: string[] }) {
  const tilt = ["-rotate-[10deg] translate-x-6", "z-10 -translate-y-2", "rotate-[10deg] -translate-x-6"]
  return (
    <div aria-hidden="true" className="flex shrink-0 items-end justify-center">
      {images.slice(0, 3).map((src, i) => (
        <span key={src} className={`block h-24 w-20 rounded-xl bg-white p-1.5 shadow-lg sm:h-32 sm:w-28 ${tilt[i]}`}>
          <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
        </span>
      ))}
    </div>
  )
}

/** A promotion's card: offer stamp, countdown, its best products fanned out, and its aisles */
export function CampaignCard({ section }: { section: Of<"CAMPAIGN_CARD"> }) {
  const { theme } = section
  const fan = section.highlights.flatMap((p) => p.imageUrl ?? [])
  return (
    <section aria-labelledby={`s-${section.id}`} className="mx-auto mt-10 max-w-7xl px-2 sm:px-4">
      <div className="overflow-hidden rounded-3xl p-4 sm:p-6" style={{ background: theme.background, color: theme.title }}>
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {section.offerLabel && <span className="rounded-lg bg-amber px-2.5 py-1 text-sm font-extrabold text-amber-ink -rotate-2">{section.offerLabel}</span>}
              {section.endsAt && <Countdown endsAt={section.endsAt} ink={theme.title} />}
            </div>
            <h2 id={`s-${section.id}`} className="mt-2 text-2xl font-extrabold tracking-tight sm:text-3xl">{section.title}</h2>
            {section.subtitle && <p className="mt-1 text-sm font-semibold opacity-80">{section.subtitle}</p>}
          </div>
          {section.imageUrl ? <img src={section.imageUrl} alt="" loading="lazy" className="h-32 w-auto self-center object-contain sm:h-40" /> : fan.length > 0 && <HighlightFan images={fan} />}
        </div>
        {section.tiles.length > 0 && (
          <ul className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
            {section.tiles.map((t) => (
              <li key={t.href}>
                <a href={t.href} className="block h-full rounded-2xl bg-white/70 p-2 text-center hover:bg-white">
                  <PackCluster images={t.images} />
                  <span className="mt-1.5 line-clamp-2 block text-xs font-bold leading-4 text-ink">{t.label}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
        {section.href && (
          <a href={section.href} className="mx-auto mt-5 flex min-h-11 w-fit items-center gap-1.5 rounded-full px-7 text-sm font-extrabold text-white hover:opacity-90" style={{ background: theme.title }}>
            Shop all {section.productCount} <Icon name="arrow" size={16} />
          </a>
        )}
      </div>
    </section>
  )
}

/** The store's own ranges: a photo, its aisles and a row of its products each */
export function StoreSpecials({ section }: { section: Of<"STORE_SPECIALS"> }) {
  return (
    <Section id={section.id} band="#fdebd3">
      <SectionHead id={section.id} title={section.title ?? "Only at this store"} subtitle={section.subtitle} fallback="Only at this store" style={{ color: "#7c3a0a" }} />
      <div className="space-y-8">
        {section.collections.map((c) => (
          <div key={c.href}>
            <a href={c.href} className="flex items-center gap-4">
              {c.imageUrl && <img src={c.imageUrl} alt="" loading="lazy" className="h-20 w-28 rounded-2xl object-cover sm:h-24 sm:w-36" />}
              <span>
                <b className="block text-lg text-[#7c3a0a]">{c.title}</b>
                {c.subtitle && <span className="text-sm text-muted">{c.subtitle}</span>}
              </span>
            </a>
            {c.aisles.length > 0 && (
              <div className="my-3 flex flex-wrap gap-2">
                {c.aisles.map((a) => <a key={a.href} href={a.href} className="rounded-full bg-white px-3 py-2 text-sm font-bold hover:bg-amber/30">{a.label}</a>)}
              </div>
            )}
            <ProductRail products={c.products} />
          </div>
        ))}
      </div>
    </Section>
  )
}
