import { LINKS } from "~/lib/site"
import { Icon } from "./icons"

export function AppBand() {
  return (
    <section aria-labelledby="get-app" className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-28">
      <div className="flex flex-col gap-8 rounded-[28px] bg-brand-deep p-8 text-white sm:p-12 lg:flex-row lg:items-center">
        <img src="/brand/app-icon.png" alt="" width={120} height={120} loading="lazy" className="h-24 w-24 rounded-[26px] ring-4 ring-white/10 sm:h-28 sm:w-28" />
        <div className="flex-1">
          <h2 id="get-app" className="text-2xl font-extrabold tracking-tight sm:text-[32px]">Shop quicker on the Martly app</h2>
          <p className="mt-2 text-base leading-relaxed text-teal-100 sm:text-[17px]">Reorder in two taps, track your delivery, and say your list in Tamil.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <a href={LINKS.playStore} className="flex h-14 flex-col justify-center rounded-[14px] bg-ink px-5 hover:bg-black">
            <span className="text-[11px] uppercase tracking-wider text-slate-300">Get it on</span>
            <span className="text-[17px] font-extrabold">Google Play</span>
          </a>
          <span className="flex h-14 items-center gap-3 rounded-[14px] border border-white/15 px-5">
            <Icon name="phone" size={20} className="text-teal-200" />
            <span>
              <span className="block text-[11px] uppercase tracking-wider text-teal-200">Coming soon on the</span>
              <span className="block text-[17px] font-extrabold">App Store</span>
            </span>
          </span>
        </div>
      </div>
    </section>
  )
}

export function OwnersBand() {
  return (
    <section id="owners" aria-labelledby="owners-title" className="mx-auto max-w-7xl scroll-mt-20 px-4 pt-6 sm:px-6">
      <div className="flex flex-col gap-6 rounded-[28px] bg-amber-100 p-8 sm:p-12 lg:flex-row lg:items-center">
        <div className="flex-1">
          <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-amber-800">For store owners</p>
          <h2 id="owners-title" className="mt-2 text-2xl font-extrabold tracking-tight text-amber-ink sm:text-[30px]">Run a shop? Bring it online with Martly.</h2>
          <p className="mt-2 max-w-2xl text-base leading-relaxed text-amber-900">
            Your own shop address like martlyshop.in/your-town/your-store, orders on your phone, and your catalogue and prices set up for you.
          </p>
        </div>
        <a href={LINKS.contact} className="inline-flex h-[52px] items-center justify-center gap-2 rounded-full bg-amber-ink px-7 font-extrabold text-white hover:bg-black">
          Talk to us <Icon name="arrow" size={18} />
        </a>
      </div>
    </section>
  )
}
