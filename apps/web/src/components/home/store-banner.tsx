import type { WebShopStore, WebStoreProfile } from "@martly/shared/types"
import { rupees } from "~/lib/format"
import { Icon, type IconName } from "../icons"
import { PAGE } from "./parts"
import { AppPanel, DeliveryPanel } from "./store-panels"

// The app's fallback when a store has no colour of its own
export const MARTLY_TEAL = "#0f766e"

/** Light brand colours (yellows, pastels) need dark text, as in the app */
export function isLight(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255) > 170
}

function Fact({ icon, children, light }: { icon: IconName; children: string; light: boolean }) {
  return (
    <li className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${light ? "bg-black/10" : "bg-white/15 ring-1 ring-white/25"}`}>
      <Icon name={icon} size={15} className="shrink-0" strokeWidth={2.25} />
      <span className="whitespace-nowrap">{children}</span>
    </li>
  )
}

/** "Kaveri Fresh" → "KF", for a store without a logo */
export function initials(name: string) {
  return name.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase()
}

/** The store's logo on a white plate shaped like it, or its initials on its colour */
function Logo({ store, color }: { store: WebShopStore; color: string }) {
  const plate = "flex h-[72px] shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/15 sm:h-24"
  if (store.logoUrl) {
    return (
      <span className={`${plate} max-w-[160px] p-2 sm:max-w-[220px] sm:p-2.5`}>
        <img src={store.logoUrl} alt={`${store.name} logo`} className="h-full w-auto max-w-full object-contain" />
      </span>
    )
  }
  return <span className={`${plate} w-[72px] text-2xl font-extrabold sm:w-24 sm:text-3xl`} style={{ color }}>{initials(store.name)}</span>
}

function facts(profile: WebStoreProfile) {
  const list: { icon: IconName; text: string }[] = []
  if (profile.offerText) list.push({ icon: "tag", text: profile.offerText })
  else if (profile.deals) list.push({ icon: "tag", text: `Up to ${profile.deals.maxPercent}% off on ${profile.deals.count} items` })
  if (profile.rating && profile.rating.count > 0) list.push({ icon: "star", text: `${profile.rating.average} (${profile.rating.count} ratings)` })
  if (profile.freeDeliveryAbove != null) list.push({ icon: "bike", text: profile.freeDeliveryAbove > 0 ? `Free delivery above ${rupees(profile.freeDeliveryAbove)}` : "Free delivery" })
  return list
}

/** The store's own logo, name and offer lead Home, so it reads as their shop that Martly runs */
export function StoreBanner({ store, profile }: { store: WebShopStore; profile: WebStoreProfile | null }) {
  const color = profile?.brandColor ?? MARTLY_TEAL
  const list = profile ? facts(profile) : []
  const light = isLight(color)
  const ink = light ? "text-ink" : "text-white"
  const soft = light ? "text-ink/70" : "text-white/80"
  return (
    <section aria-labelledby="store-name" className={ink} style={{ background: `linear-gradient(120deg, ${color}, color-mix(in srgb, ${color} 78%, black))` }}>
      <div className={`${PAGE} flex items-center gap-4 py-5 sm:gap-6 sm:py-7`}>
        <Logo store={store} color={color} />
        <div className="min-w-0 flex-1">
          <h1 id="store-name">
            <span className="block truncate text-[26px] font-extrabold leading-tight tracking-tight sm:text-4xl">{store.name}</span>
            <span className={`mt-0.5 block text-sm font-semibold sm:text-base ${soft}`}>{profile?.tagline ?? `Groceries online in ${store.town.name}`}</span>
          </h1>
          {profile && (
            <p className={`mt-1 hidden items-center gap-1 truncate text-[13px] sm:flex ${soft}`}>
              <Icon name="pin" size={14} className="shrink-0" />{profile.address}
            </p>
          )}
          {list.length > 0 && (
            <ul className="mt-3 hidden flex-wrap gap-2 sm:flex">
              {list.map((f) => <Fact key={f.text} icon={f.icon} light={light}>{f.text}</Fact>)}
            </ul>
          )}
        </div>
        <aside aria-label="Delivery and the app" className="hidden shrink-0 items-stretch gap-3 lg:flex">
          {profile && <DeliveryPanel delivery={profile.delivery} />}
          <div className="hidden xl:flex"><AppPanel store={store} /></div>
        </aside>
      </div>
      {list.length > 0 && (
        <ul className="-mt-1 flex gap-2 overflow-x-auto px-4 pb-4 [scrollbar-width:none] sm:hidden">
          {list.map((f) => <Fact key={f.text} icon={f.icon} light={light}>{f.text}</Fact>)}
        </ul>
      )}
    </section>
  )
}
