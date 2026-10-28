import type { WebProductBrand } from "@martly/shared/types"
import { Icon } from "./icons"

// A stable ink per brand without a theme colour, picked from its name as the app does
const WORDMARK_INKS = ["#9a3412", "#075985", "#166534", "#92400e", "#5b21b6", "#9d174d", "#115e59", "#991b1b"]

// Mix a hex colour toward black (amount 0–1)
function shade(hex: string, amount: number) {
  const n = parseInt(hex.slice(1), 16)
  const ch = (shift: number) => Math.round(((n >> shift) & 255) * (1 - amount)).toString(16).padStart(2, "0")
  return `#${ch(16)}${ch(8)}${ch(0)}`
}

/** A brand's store colours, as in the app: its theme colour (else a stable ink), a darker shade, and its second logo colour */
function brandTheme(brand: WebProductBrand) {
  const hash = [...brand.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
  const base = brand.themeColor ?? WORDMARK_INKS[hash % WORDMARK_INKS.length]
  return { base, dark: shade(base, 0.35), accent: brand.themeColorSecondary ?? base }
}

// "Fortune (Adani Wilmar)" → "Fortune": the parenthetical is the parent company
const displayName = (name: string) => name.replace(/\s*\(.*\)\s*/g, " ").trim()

/** Logo and name in the brand's colour, above the product name; it opens the brand's store */
export function BrandChip({ brand }: { brand: WebProductBrand }) {
  const { base } = brandTheme(brand)
  const name = displayName(brand.name)
  return (
    <a href={brand.href} aria-label={`Shop all ${name}`} style={{ borderColor: `${base}55`, backgroundColor: `${base}0F`, color: base }}
      className="inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border pl-1 pr-3 text-sm font-extrabold transition hover:brightness-95">
      {brand.imageUrl && (
        <span className="flex h-7 w-11 shrink-0 items-center justify-center rounded-full bg-white p-0.5">
          <img src={brand.imageUrl} alt="" className="h-full w-full object-contain" />
        </span>
      )}
      <span className="truncate">{name}</span>
      <Icon name="chevron" size={14} className="-rotate-90" />
    </a>
  )
}

/** The brand-store call to action in the brand's own gradient, after the product details */
export function BrandStoreBanner({ brand }: { brand: WebProductBrand }) {
  const { base, dark, accent } = brandTheme(brand)
  const name = displayName(brand.name)
  return (
    <a href={brand.href} aria-label={`Shop all ${name}`}
      style={{ background: `linear-gradient(135deg, ${base}, ${dark})`, borderBottom: brand.themeColorSecondary ? `4px solid ${accent}` : undefined }}
      className="relative mt-8 flex items-center gap-4 overflow-hidden rounded-[18px] p-4 text-white transition hover:brightness-105">
      <span aria-hidden="true" className="absolute -right-10 -top-16 h-40 w-40 rounded-full bg-white/10" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-4 -right-1 whitespace-nowrap text-6xl font-extrabold tracking-tighter text-white/[0.08]">{name}</span>
      <span className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-white p-1.5 shadow-lg">
        {brand.imageUrl
          ? <img src={brand.imageUrl} alt="" className="h-full w-full object-contain" />
          : <span className="line-clamp-2 text-center text-xs font-extrabold" style={{ color: base }}>{name}</span>}
      </span>
      <span className="relative min-w-0 flex-1">
        <span className="block text-[10px] font-extrabold tracking-[0.16em] text-white/80">BRAND STORE</span>
        <span className="block truncate text-lg font-extrabold tracking-tight">Shop all {name}</span>
        <span className="block text-[13px] font-semibold text-white/85">Every pack size, in one place</span>
      </span>
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white" style={{ color: base }}>
        <Icon name="arrow" size={18} />
      </span>
    </a>
  )
}
