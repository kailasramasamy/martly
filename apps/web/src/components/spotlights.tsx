import { spotlights, type Spotlight } from "~/lib/content"
import { Icon } from "./icons"
import { PhoneFrame } from "./phone-frame"

function SpotlightRow({ item, flip }: { item: Spotlight; flip: boolean }) {
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
      <div className={flip ? "lg:order-2" : ""}>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">{item.kicker}</p>
        <h3 className="mt-3 text-2xl font-extrabold tracking-tight sm:text-[32px] sm:leading-tight">{item.title}</h3>
        <p className="mt-4 max-w-lg text-base leading-relaxed text-muted sm:text-[17px]">{item.body}</p>
        <ul className="mt-7 grid gap-2.5 sm:grid-cols-2">
          {item.chips.map((c) => (
            <li key={c} className="flex items-center gap-2.5 text-[15px] font-medium text-slate-700">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-tint text-brand">
                <Icon name="check" size={13} strokeWidth={3} />
              </span>
              {c}
            </li>
          ))}
        </ul>
      </div>
      <div className={`relative flex justify-center ${flip ? "lg:order-1" : ""}`}>
        <div aria-hidden="true" className="absolute inset-x-8 inset-y-10 rounded-[3rem] bg-brand-tint" />
        <PhoneFrame src={item.image} alt={item.alt} className="relative w-[250px] sm:w-[270px]" />
      </div>
    </div>
  )
}

/** App screenshots beside what each screen does, alternating sides */
export function Spotlights() {
  return (
    <section id="app" className="scroll-mt-20 pt-24 sm:pt-28">
      <div className="mx-auto max-w-2xl px-4 text-center">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">The Martly app</p>
        <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl">Everything you need from your local store.</h2>
      </div>
      <div className="mx-auto mt-16 flex max-w-6xl flex-col gap-24 px-4 sm:px-6">
        {spotlights.map((item, i) => <SpotlightRow key={item.title} item={item} flip={i % 2 === 1} />)}
      </div>
    </section>
  )
}
