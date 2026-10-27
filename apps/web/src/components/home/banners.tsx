import { useEffect, useState } from "react"
import type { FestiveFont } from "@martly/shared/constants"
import type { WebBanner, WebHomeSection } from "@martly/shared/types"
import { Art, Section, SectionHead } from "./parts"

type Of<T> = Extract<WebHomeSection, { type: T }>

/** Festival headlines in the typeface the festival picked, as the app draws them */
export const FESTIVE_FONTS: Record<FestiveFont, string> = {
  PLAYFAIR: "'Playfair Display', serif",
  YATRA: "'Yatra One', serif",
  KALAM: "'Kalam', cursive",
  LOBSTER: "'Lobster', cursive",
}

const SLIDE_MS = 6000

/** A festival's slides, turning on their own, each with its aisle tiles */
export function FestiveHero({ section }: { section: Of<"FESTIVE_HERO"> }) {
  const [index, setIndex] = useState(0)
  const count = section.slides.length
  useEffect(() => {
    if (count < 2) return
    const timer = setTimeout(() => setIndex((i) => (i + 1) % count), SLIDE_MS)
    return () => clearTimeout(timer)
  }, [index, count])
  const slide = section.slides[index]
  const { theme } = slide
  return (
    <section aria-labelledby={`s-${section.id}`} className="pt-6" style={{ background: `linear-gradient(180deg, ${theme.background}, #fff)` }}>
      <div className="mx-auto grid max-w-7xl gap-5 px-4 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
        <a href={slide.href} className="block overflow-hidden rounded-3xl"><img src={slide.imageUrl} alt="" className="aspect-[1200/477] w-full object-cover" /></a>
        <div style={{ color: theme.title }}>
          {slide.kicker && <p className="text-xs font-bold uppercase tracking-[0.1em] opacity-80">{slide.kicker}</p>}
          <h2 id={`s-${section.id}`} className="mt-1 text-3xl leading-tight sm:text-4xl" style={{ fontFamily: FESTIVE_FONTS[theme.font ?? "PLAYFAIR"] }}>
            <a href={slide.href}>{slide.title}</a>
          </h2>
          {slide.subtitle && <p className="mt-2 text-sm font-semibold opacity-80">{slide.subtitle}</p>}
          <ul className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6 lg:grid-cols-3">
            {slide.tiles.map((t) => (
              <li key={t.href}>
                <a href={t.href} className="block rounded-xl bg-white/70 p-1.5 text-center hover:bg-white">
                  <Art src={t.imageUrl} className="aspect-square w-full" />
                  <span className="line-clamp-1 text-xs font-bold text-ink">{t.label}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-1.5 pt-4">
          {section.slides.map((s, i) => (
            <button key={s.id} aria-label={`Show ${s.title}`} onClick={() => setIndex(i)} className="flex h-6 items-center">
              <span className={`h-1.5 rounded-full ${i === index ? "w-[18px]" : "w-1.5 opacity-30"}`} style={{ background: theme.title }} />
            </button>
          ))}
        </div>
      )}
    </section>
  )
}

export function BannerImage({ banner, className, onOpen }: { banner: WebBanner; className: string; onOpen?: () => void }) {
  const art = (
    <span className="relative block overflow-hidden rounded-2xl bg-surface">
      <img src={banner.imageUrl} alt={banner.textInImage ? banner.title : ""} loading="lazy" className={`w-full object-cover ${className}`} />
      {!banner.textInImage && (
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-4 text-white">
          <b className="block text-lg leading-tight">{banner.title}</b>
          {banner.subtitle && <span className="text-sm opacity-90">{banner.subtitle}</span>}
        </span>
      )}
    </span>
  )
  return banner.href ? <a href={banner.href} onClick={onOpen} className="block transition hover:opacity-95">{art}</a> : art
}

/** Wide banners on HERO_BANNERS (3:2) and tall brand posters (2:3), in a snapping rail */
export function Banners({ section }: { section: Of<"HERO_BANNERS" | "BRAND_POSTERS"> }) {
  const poster = section.type === "BRAND_POSTERS"
  // A lone banner or a pair takes more of the row than a full rail would, so it isn't stranded at the left
  const few = section.banners.length <= 2
  const width = poster ? "w-[44%] sm:w-[26%] lg:w-[23.5%]" : few ? "w-[86%] sm:w-[49%]" : "w-[86%] sm:w-[48%] lg:w-[32.5%]"
  return (
    <Section id={section.id}>
      <SectionHead id={section.id} title={section.title} subtitle={section.subtitle} fallback={poster ? "Brands in store" : "Offers"} />
      <ul className="-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:scroll-px-6 sm:px-6 [scrollbar-width:none]">
        {section.banners.map((b) => (
          <li key={b.id} className={`shrink-0 snap-start ${width}`}>
            <BannerImage banner={b} className={poster ? "aspect-[2/3]" : "aspect-[3/2]"} />
          </li>
        ))}
      </ul>
    </Section>
  )
}
