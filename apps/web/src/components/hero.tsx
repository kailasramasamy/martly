import { LINKS } from "~/lib/site"
import { Icon, Smile } from "./icons"
import { PhoneFrame } from "./phone-frame"

/** Faint grid and soft teal and amber light behind the hero, after the quartex.in Martly page */
export function Backdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-48 left-1/4 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,#14b8a666_0%,transparent_65%)] blur-3xl" />
      <div className="absolute -right-32 top-24 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle,#fbbf2426_0%,transparent_65%)] blur-3xl" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0d_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0d_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_50%_0%,#000_30%,transparent_75%)]" />
    </div>
  )
}

function PhoneStack() {
  return (
    <div className="relative mx-auto h-[500px] w-full max-w-[500px] sm:h-[580px]">
      <PhoneFrame src="/screenshots/owners/orders.webp" alt="Orders for a store in the Martly app" className="absolute left-0 top-20 hidden w-[210px] -rotate-6 opacity-90 sm:block" />
      <PhoneFrame src="/screenshots/owners/shop-home.webp" alt="A store's Home in the Martly app" className="absolute right-0 top-20 hidden w-[210px] rotate-6 opacity-90 sm:block" />
      <div className="phone-float absolute inset-x-0 top-0 flex justify-center">
        <PhoneFrame src="/screenshots/owners/today.webp" alt="The store owner's Today screen in the Martly app" className="w-[240px] sm:w-[250px]" eager />
      </div>
    </div>
  )
}

/** The /for-stores hero: the pitch to shop owners beside the app their customers get */
export function OwnersHero() {
  return (
    <section className="relative isolate overflow-hidden bg-brand-ink text-white">
      <Backdrop />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-20">
        <div>
          <p className="mb-6 text-sm font-extrabold uppercase tracking-[0.12em] text-amber">For store owners</p>
          <h1 className="text-[40px] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[64px]">
            Your shop,
            <br />
            now{" "}
            <span className="relative inline-block text-brand-mint">
              online.
              <Smile className="absolute -bottom-3 left-[2%] h-5 w-[92%]" />
            </span>
          </h1>
          <p className="mb-8 mt-9 max-w-lg text-lg leading-relaxed text-teal-100 sm:text-xl">
            Your customers order from your shelves on the Martly app and on martlyshop.in. You pack and deliver, as you do today.
          </p>
          <a href={LINKS.contact} className="inline-flex h-[52px] items-center gap-2 rounded-[14px] bg-amber px-7 text-base font-extrabold text-amber-ink hover:bg-amber-300">
            Talk to us <Icon name="arrow" size={18} />
          </a>
          <a href="/for-stores/pricing" className="ml-3 inline-flex h-[52px] items-center rounded-[14px] px-5 text-base font-extrabold text-white ring-1 ring-white/25 hover:bg-white/10">
            See pricing
          </a>
        </div>
        <PhoneStack />
      </div>
    </section>
  )
}
