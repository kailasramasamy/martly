import { useEffect } from "react"
import { recordAdEvents } from "./api"

type AdEvent = { bannerId: string; type: "VIEW" | "TAP" }

const FLUSH_MS = 2000
let queue: { storeId: string; event: AdEvent }[] = []
let timer: ReturnType<typeof setTimeout> | null = null

/** Sends the queued views and taps per store, counted per banner, as the app batches its banner events */
function flush() {
  timer = null
  const byStore = new Map<string, Map<string, AdEvent & { count: number }>>()
  for (const { storeId, event } of queue) {
    const counts = byStore.get(storeId) ?? new Map()
    const key = `${event.bannerId}:${event.type}`
    const seen = counts.get(key)
    counts.set(key, { ...event, count: Math.min((seen?.count ?? 0) + 1, 20) })
    byStore.set(storeId, counts)
  }
  queue = []
  for (const [storeId, counts] of byStore) void recordAdEvents({ data: { storeId, events: [...counts.values()] } })
}

/** Views wait for the batch; a tap goes at once, since it usually opens another page */
export function recordAd(storeId: string, event: AdEvent) {
  queue.push({ storeId, event })
  if (event.type === "TAP") {
    if (timer) clearTimeout(timer)
    flush()
  } else {
    timer ??= setTimeout(flush, FLUSH_MS)
  }
}

/** Counts a sponsored result's view once it is on the page */
export function useAdView(storeId: string, bannerId: string | undefined) {
  useEffect(() => {
    if (bannerId) recordAd(storeId, { bannerId, type: "VIEW" })
  }, [storeId, bannerId])
}
