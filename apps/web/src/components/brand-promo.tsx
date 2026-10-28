import type { WebProductBrand } from "@martly/shared/types"
import { Icon } from "./icons"

// A stable ink per brand without a theme colour, picked from its name as the app does
const WORDMARK_INKS = ["#9a3412", "#075985", "#166534", "#92400e", "#5b21b6", "#9d174d", "#115e59", "#991b1b"]

/** A brand's colour, as in the app: its theme colour, else a stable ink */
function brandColor(brand: WebProductBrand) {
  const hash = [...brand.name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 0)
  return brand.themeColor ?? WORDMARK_INKS[hash % WORDMARK_INKS.length]
}

// "Fortune (Adani Wilmar)" → "Fortune": the parenthetical is the parent company
const displayName = (name: string) => name.replace(/\s*\(.*\)\s*/g, " ").trim()

/** Logo and name in the brand's colour, above the product name; it opens the brand's store */
export function BrandChip({ brand }: { brand: WebProductBrand }) {
  const base = brandColor(brand)
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
