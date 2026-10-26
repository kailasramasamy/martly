import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react"
import { LINKS } from "~/lib/site"
import { Icon } from "./icons"

/** Opens the "order on the app" sheet for a product; ordering on the web comes later */
const AppSheetContext = createContext<(productName: string) => void>(() => {})

export const useAppSheet = () => useContext(AppSheetContext)

export function AppSheetProvider({ children }: { children: ReactNode }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [product, setProduct] = useState<string | null>(null)
  const open = useCallback((name: string) => setProduct(name), [])

  useEffect(() => {
    if (product) dialog.current?.showModal()
  }, [product])

  return (
    <AppSheetContext.Provider value={open}>
      {children}
      <dialog
        ref={dialog}
        onClose={() => setProduct(null)}
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
        aria-labelledby="app-sheet-title"
        className="m-auto w-[calc(100%-32px)] max-w-md rounded-[24px] p-0 backdrop:bg-ink/50 max-sm:mb-4"
      >
        <div className="p-6 sm:p-7">
          <div className="flex items-start gap-4">
            <img src="/brand/app-icon.png" alt="" width={56} height={56} className="h-14 w-14 rounded-2xl" />
            <div className="flex-1">
              <h2 id="app-sheet-title" className="text-xl font-extrabold tracking-tight">Order on the Martly app</h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                {product ? <>Add <b className="text-ink">{product}</b> to your cart in the app. </> : null}
                Ordering on the website is coming soon.
              </p>
            </div>
            <button onClick={() => dialog.current?.close()} aria-label="Close" className="-mr-2 -mt-2 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-surface">
              <Icon name="close" size={20} />
            </button>
          </div>
          <div className="mt-6 flex items-center gap-5 rounded-2xl bg-surface p-4">
            <img src="/brand/play-qr.svg" alt="QR code for the Martly app on Google Play" width={112} height={112} className="hidden h-28 w-28 rounded-lg sm:block" />
            <div className="flex-1">
              <p className="hidden text-sm font-semibold text-slate-600 sm:block">Scan with your phone's camera, or</p>
              <a href={LINKS.playStore} className="mt-2 inline-flex h-12 items-center gap-2 rounded-full bg-brand px-5 font-bold text-white hover:bg-brand-deep max-sm:w-full max-sm:justify-center">
                Get it on Google Play <Icon name="arrow" size={17} />
              </a>
            </div>
          </div>
        </div>
      </dialog>
    </AppSheetContext.Provider>
  )
}
