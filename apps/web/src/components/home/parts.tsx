import type { CSSProperties, ReactNode } from "react"
import { SeeAll } from "../shelf"
import { Icon } from "../icons"

export const PAGE = "mx-auto max-w-7xl px-4 sm:px-6"

/** A section on the page's column; a band paints its background to the window edges */
export function Section({ id, band, className = "", children }: { id: string; band?: string; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`s-${id}`} className={band ? "mt-10 py-6 sm:py-8" : "pt-10"} style={band ? { background: band } : undefined}>
      <div className={`${PAGE} ${className}`}>{children}</div>
    </section>
  )
}

/** A section's title, subtitle and "See all"; untitled sections still name themselves for screen readers */
export function SectionHead({ id, title, subtitle, href, fallback, style }: {
  id: string; title: string | null; subtitle?: string | null; href?: string | null; fallback: string; style?: CSSProperties
}) {
  if (!title) return <h2 id={`s-${id}`} className="sr-only">{fallback}</h2>
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 id={`s-${id}`} className="text-xl font-extrabold tracking-tight sm:text-2xl" style={style}>{title}</h2>
        {subtitle && <p className="mt-0.5 text-sm font-medium text-muted">{subtitle}</p>}
      </div>
      {href && <SeeAll href={href} />}
    </div>
  )
}

/** Product or tile art on a soft square, or a basket when there is none */
export function Art({ src, alt = "", className = "", fit = "contain" }: { src: string | null; alt?: string; className?: string; fit?: "contain" | "cover" }) {
  if (!src) return <span className={`flex items-center justify-center text-muted ${className}`}><Icon name="basket" size={28} strokeWidth={1.5} /></span>
  return <img src={src} alt={alt} loading="lazy" className={`${fit === "cover" ? "object-cover" : "object-contain"} ${className}`} />
}

/** Up to four product photos in a 2×2 grid, as a category or aisle's preview */
export function PackCluster({ images, className = "" }: { images: string[]; className?: string }) {
  return (
    <span className={`grid grid-cols-2 gap-1 ${className}`}>
      {images.slice(0, 4).map((src) => (
        <span key={src} className={`rounded-lg bg-white p-1 ${images.length === 1 ? "col-span-2 aspect-[2/1]" : "aspect-square"}`}>
          <img src={src} alt="" loading="lazy" className="h-full w-full object-contain" />
        </span>
      ))}
    </span>
  )
}

/** A sideways rail on phones that becomes a grid of `cols` on wider screens */
export function TileRail({ children, cols = "sm:grid-cols-4 lg:grid-cols-6" }: { children: ReactNode; cols?: string }) {
  return (
    <ul className={`-mx-4 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:gap-4 sm:overflow-visible sm:px-0 [scrollbar-width:none] ${cols}`}>
      {children}
    </ul>
  )
}
