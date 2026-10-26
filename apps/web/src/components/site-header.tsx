import type { WebShopStore, WebTown } from "@martly/shared/types"
import { LINKS } from "~/lib/site"
import { StorePicker } from "./store-picker"
import { SearchBox } from "./search/search-box"

/** Logo, the shopper's town and store, product search and the app link; search drops to its own row on phones */
export function SiteHeader({ store, towns, q }: { store: WebShopStore | null; towns: WebTown[]; q?: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:h-[72px] sm:gap-4 sm:px-6">
        <a href="/" aria-label="Martly home" className="flex shrink-0">
          <img src="/brand/wordmark.svg" alt="Martly" width={96} height={39} className="h-8 w-auto sm:h-9" />
        </a>
        <StorePicker store={store} towns={towns} />
        <SearchBox key={q} q={q} storeId={store?.id} className="hidden flex-1 md:block" />
        <div className="flex-1 md:hidden" />
        <a href={LINKS.playStore} className="inline-flex h-11 shrink-0 items-center whitespace-nowrap rounded-full bg-brand px-4 text-sm font-bold text-white hover:bg-brand-deep sm:px-5">
          Get<span className="hidden sm:inline">&nbsp;the</span>&nbsp;app
        </a>
      </div>
      <div className="px-4 pb-3 md:hidden">
        <SearchBox key={q} q={q} storeId={store?.id} className="block" />
      </div>
    </header>
  )
}
