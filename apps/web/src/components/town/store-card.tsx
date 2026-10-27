import type { WebTownPage, WebTownStore } from "@martly/shared/types"
import { STORE_SIZE_RULES } from "@martly/shared/constants"
import { rupees } from "~/lib/format"
import { Icon, type IconName } from "../icons"
import { MARTLY_TEAL, initials, isLight } from "../home/store-banner"
import { OpenLine, clock, dayLabel } from "../home/store-panels"
import { storePath } from "../stores-section"

/** The store's cover banner, or its own colour when it has none yet */
function Cover({ store, color }: { store: WebTownStore; color: string }) {
  if (store.coverUrl) {
    return <img src={store.coverUrl} alt={`${store.name} offers`} loading="lazy" className="aspect-[3/2] w-full bg-surface object-cover" />
  }
  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center" style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 70%, black))` }}>
      <Icon name="basket" size={72} strokeWidth={1.25} className={isLight(color) ? "text-ink/25" : "text-white/30"} />
    </div>
  )
}

function LogoChip({ store, color }: { store: WebTownStore; color: string }) {
  const plate = "-mt-9 flex h-[72px] shrink-0 items-center justify-center rounded-2xl bg-white shadow-lg shadow-black/15 ring-4 ring-white"
  if (store.logoUrl) {
    return (
      <span className={`${plate} max-w-[140px] p-2`}>
        <img src={store.logoUrl} alt={`${store.name} logo`} loading="lazy" className="h-full w-auto max-w-full object-contain" />
      </span>
    )
  }
  return <span className={`${plate} w-[72px] text-2xl font-extrabold`} style={{ color }}>{initials(store.name)}</span>
}

/** How soon an order comes: express while the store is open, else its next slot */
function deliveryFact({ delivery }: WebTownStore) {
  if (delivery.openNow && delivery.expressMinutes) return `Delivery in ${delivery.expressMinutes} min`
  const slot = delivery.nextSlot
  if (slot) return `Next delivery ${dayLabel(slot.date, delivery.today).toLowerCase()}, ${clock(slot.startTime)}–${clock(slot.endTime)}`
  return null
}

function facts(store: WebTownStore) {
  const list: { icon: IconName; text: string }[] = []
  const delivery = deliveryFact(store)
  if (delivery) list.push({ icon: "bike", text: delivery })
  if (store.productCount) list.push({ icon: "basket", text: `${store.productCount.toLocaleString("en-IN")} products` })
  if (store.offerText) list.push({ icon: "tag", text: store.offerText })
  else if (store.deals) list.push({ icon: "tag", text: `Up to ${store.deals.maxPercent}% off on ${store.deals.count} items` })
  if (store.freeDeliveryAbove != null) list.push({ icon: "wallet", text: store.freeDeliveryAbove > 0 ? `Free delivery above ${rupees(store.freeDeliveryAbove)}` : "Free delivery" })
  if (store.rating && store.rating.count > 0) list.push({ icon: "star", text: `${store.rating.average} from ${store.rating.count} ratings` })
  return list
}

/** A store's shopfront on its town's page: cover, logo, today's hours and what ordering from it is like */
export function TownStoreCard({ town, store }: { town: WebTownPage["town"]; store: WebTownStore }) {
  const color = store.brandColor ?? MARTLY_TEAL
  const href = storePath(town, store)
  return (
    <article className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-white">
      <a href={href} tabIndex={-1} aria-hidden="true"><Cover store={store} color={color} /></a>
      <div className="flex flex-1 flex-col px-5 pb-5">
        <div className="flex items-end justify-between gap-3">
          <LogoChip store={store} color={color} />
          {store.size && <span className="mb-1 rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold text-brand-deep">{STORE_SIZE_RULES[store.size].label}</span>}
        </div>
        <h2 className="mt-3 text-xl font-extrabold tracking-tight"><a href={href} className="hover:text-brand">{store.name}</a></h2>
        {store.tagline && <p className="mt-0.5 text-sm text-muted">{store.tagline}</p>}
        <div className="mt-2"><OpenLine delivery={store.delivery} /></div>
        <p className="mt-1.5 flex gap-1.5 text-[13px] leading-snug text-muted">
          <Icon name="pin" size={15} className="mt-px shrink-0" />{store.address}
        </p>
        <ul className="mt-4 grid gap-2.5 border-t border-line pt-4">
          {facts(store).map((f) => (
            <li key={f.text} className="flex items-center gap-2.5 text-sm font-semibold">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-tint text-brand"><Icon name={f.icon} size={17} /></span>
              {f.text}
            </li>
          ))}
        </ul>
        <div className="mt-auto pt-5">
          <a href={href} className="flex h-12 items-center justify-center rounded-full bg-brand px-5 font-bold text-white hover:bg-brand-deep">
            Shop at {store.name}
          </a>
        </div>
      </div>
    </article>
  )
}
