import { useEffect, useRef, useState, type RefObject } from "react"
import { useRouter } from "@tanstack/react-router"
import type { WebShopStore, WebTown } from "@martly/shared/types"
import { chooseStore, isStoreChosen } from "~/lib/api"
import { Icon } from "./icons"

type Status = { tone: "info" | "warn"; text: string } | null

/** Reprices the page from a new store, as the app's store switch does */
function useSwitchStore(close: () => void, onChosen: () => void) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<Status>(null)

  const pick = async (data: Parameters<typeof chooseStore>[0]["data"]) => {
    setBusy(true)
    const result = await chooseStore({ data }).catch(() => null)
    setBusy(false)
    if (!result) return setStatus({ tone: "warn", text: "Couldn't change the store. Try again." })
    onChosen()
    await router.invalidate()
    if (result.deliversToYou === false) setStatus({ tone: "warn", text: `No store delivers to you yet. Showing ${result.name}, where you can pick up.` })
    else close()
  }

  const locate = () => {
    if (!navigator.geolocation) return setStatus({ tone: "warn", text: "Your browser can't share your location." })
    setStatus({ tone: "info", text: "Finding stores near you…" })
    navigator.geolocation.getCurrentPosition(
      (pos) => pick({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setStatus({ tone: "warn", text: "Location is off. Pick your town below." }),
      { timeout: 10_000 },
    )
  }
  return { busy, status, pick, locate }
}

function TownStores({ town, current, onPick, disabled }: { town: WebTown; current: string | undefined; onPick: (id: string) => void; disabled: boolean }) {
  return (
    <fieldset className="mt-5" disabled={disabled}>
      <legend className="text-xs font-extrabold uppercase tracking-[0.1em] text-muted">{town.name}{town.district !== town.name && ` · ${town.district}`}</legend>
      <div className="mt-2 grid gap-2">
        {town.stores.map((s) => (
          <button
            key={s.id}
            onClick={() => onPick(s.id)}
            aria-pressed={s.id === current}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-line px-3 text-left hover:border-brand aria-pressed:border-brand aria-pressed:bg-brand-tint"
          >
            {s.logoUrl
              ? <img src={s.logoUrl} alt="" width={36} height={36} className="h-9 w-9 rounded-lg bg-white object-contain" />
              : <Icon name="store" size={22} className="mx-1.5 text-brand" />}
            <span className="flex-1">
              <span className="block font-bold">{s.name}</span>
              {s.tagline && <span className="line-clamp-1 text-xs text-muted">{s.tagline}</span>}
            </span>
            {s.id === current && <Icon name="check" size={18} className="text-brand" />}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

/** A shopper who hasn't chosen a store gets the picker on their first page; closing it any way keeps the store shown, so it asks once */
function useFirstVisit(dialog: RefObject<HTMLDialogElement | null>, store: WebShopStore | null) {
  const [firstVisit, setFirstVisit] = useState(false)
  const hasStore = !!store
  useEffect(() => {
    if (!hasStore) return
    void isStoreChosen().then((chosen) => {
      if (chosen) return
      setFirstVisit(true)
      dialog.current?.showModal()
    })
  }, [dialog, hasStore])
  const keepShown = () => {
    if (!firstVisit || !store) return
    setFirstVisit(false)
    void chooseStore({ data: { storeId: store.id, town: store.town.slug } })
  }
  return { firstVisit, chosen: () => setFirstVisit(false), keepShown }
}

/** "Delivering in {town} from {store}": opens a picker of live towns and stores, or uses the shopper's location */
export function StorePicker({ store, towns }: { store: WebShopStore | null; towns: WebTown[] }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const close = () => dialog.current?.close()
  const { firstVisit, chosen, keepShown } = useFirstVisit(dialog, store)
  const { busy, status, pick, locate } = useSwitchStore(close, chosen)
  if (!store) return null

  return (
    <>
      <button onClick={() => dialog.current?.showModal()} className="flex h-11 min-w-0 items-center gap-2 rounded-full border border-line px-3 text-left hover:border-brand">
        <Icon name="pin" size={17} className="shrink-0 text-brand" />
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-extrabold">{store.town.name}</span>
          <span className="block truncate text-[11px] font-semibold text-muted">from {store.name}</span>
        </span>
        <Icon name="chevron" size={15} className="shrink-0 text-muted" />
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && close()}
        onClose={keepShown}
        aria-labelledby="store-picker-title"
        className="m-auto max-h-[85vh] w-[calc(100%-32px)] max-w-md rounded-[24px] p-0 backdrop:bg-ink/50 max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none"
      >
        {/* Opening focuses the sheet itself, so no button wears a focus ring before the shopper touches it */}
        <div className="p-6 outline-none" tabIndex={-1} autoFocus>
          <div className="flex items-center justify-between">
            <h2 id="store-picker-title" className="text-xl font-extrabold tracking-tight">Where should we deliver?</h2>
            <button onClick={close} aria-label="Close" className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface">
              <Icon name="close" size={20} />
            </button>
          </div>
          <p className="mt-1 text-sm text-muted">Prices and stock are from the store you shop at.</p>
          <button onClick={locate} disabled={busy} className="mt-5 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand font-bold text-white hover:bg-brand-deep disabled:opacity-60">
            <Icon name="locate" size={18} /> Use my location
          </button>
          {firstVisit && (
            <button onClick={close} disabled={busy} className="mt-2 flex h-12 w-full items-center justify-center rounded-full border border-line font-bold hover:border-brand disabled:opacity-60">
              Continue with {store.name}
            </button>
          )}
          {status && (
            <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm ${status.tone === "warn" ? "bg-amber-50 text-amber-900" : "bg-brand-tint text-brand-deep"}`}>{status.text}</p>
          )}
          {towns.map((t) => <TownStores key={t.slug} town={t} current={store.id} disabled={busy} onPick={(id) => pick({ storeId: id, town: t.slug })} />)}
        </div>
      </dialog>
    </>
  )
}
