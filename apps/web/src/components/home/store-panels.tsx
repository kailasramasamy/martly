import type { WebShopStore, WebStoreDelivery } from "@martly/shared/types"
import { LINKS } from "~/lib/site"
import { Icon } from "../icons"

/** "21:30" → "9:30 PM", "10:00" → "10 AM" */
export function clock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number)
  return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`
}

export function dayLabel(date: string, today: string) {
  const days = Math.round((Date.parse(date) - Date.parse(today)) / 86_400_000)
  if (days === 0) return "Today"
  if (days === 1) return "Tomorrow"
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" })
}

export function OpenLine({ delivery }: { delivery: WebStoreDelivery }) {
  if (!delivery.hours || delivery.openNow === null) return null
  const open = delivery.openNow
  return (
    <p className="flex items-center gap-2 text-[13px] font-bold">
      <span className={`h-2.5 w-2.5 rounded-full ${open ? "bg-[#22c55e] shadow-[0_0_0_4px_rgba(34,197,94,0.18)]" : "bg-slate-400"}`} />
      <span className={open ? "text-[#15803d]" : "text-muted"}>{open ? "Open now" : "Closed"}</span>
      <span className="font-semibold text-muted">· {open ? `until ${clock(delivery.hours.closes)}` : `opens ${clock(delivery.hours.opens)}`}</span>
    </p>
  )
}

/** How soon an order arrives: express while the store is open, and its next slot */
export function DeliveryPanel({ delivery }: { delivery: WebStoreDelivery }) {
  const express = delivery.openNow && delivery.expressMinutes ? delivery.expressMinutes : null
  const slot = delivery.nextSlot
  if (!express && !slot && !delivery.hours) return null
  return (
    <div className="flex w-64 flex-col justify-center gap-3 rounded-2xl bg-white p-4 text-ink shadow-lg shadow-black/10">
      <OpenLine delivery={delivery} />
      {express && (
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-tint text-brand"><Icon name="bike" size={22} /></span>
          <p className="leading-tight"><span className="block text-xs font-semibold text-muted">Delivery in</span><span className="text-xl font-extrabold">{express} min</span></p>
        </div>
      )}
      {slot && (
        <p className="border-t border-line pt-3 text-[13px] leading-snug text-muted">
          {express ? "Or book a slot" : "Next delivery"}: <b className="font-bold text-ink">{dayLabel(slot.date, delivery.today)}, {clock(slot.startTime)}–{clock(slot.endTime)}</b>
        </p>
      )}
    </div>
  )
}

/** Sends the shopper to the Martly app, under the store's own name */
export function AppPanel({ store }: { store: WebShopStore }) {
  return (
    <div className="flex w-[268px] items-center gap-3 rounded-2xl bg-white/12 p-3 ring-1 ring-white/25 backdrop-blur-sm">
      <img src="/brand/play-qr.svg" alt="QR code for the Martly app on Google Play" width={88} height={88} className="h-[88px] w-[88px] shrink-0 rounded-xl bg-white p-1.5" />
      <div className="min-w-0">
        <p className="text-[15px] font-extrabold leading-tight">Shop {store.name} on the app</p>
        <p className="mt-1 text-xs font-medium opacity-80">Scan with your phone's camera</p>
        <a href={LINKS.playStore} className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-extrabold text-ink hover:bg-white/90">
          Google Play <Icon name="arrow" size={14} />
        </a>
      </div>
    </div>
  )
}
