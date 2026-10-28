import { customerScreens } from "~/lib/content"
import { PhoneFrame } from "./phone-frame"

/** A row of shopper screens: what the owner's customers see */
export function CustomerScreens() {
  return (
    <section aria-labelledby="customers-title" className="mt-24 bg-brand-ink py-20 text-white sm:mt-28 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand-mint">For your customers</p>
        <h2 id="customers-title" className="mt-3 max-w-2xl text-3xl font-extrabold tracking-tight sm:text-4xl">An app as easy as the big ones, with your shop in it.</h2>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-teal-100 sm:text-[17px]">
          Customers shop your shelves aisle by aisle, say their list in Tamil or English, and track the order to their door.
        </p>
      </div>
      <ul className="mx-auto mt-12 flex max-w-7xl snap-x gap-5 overflow-x-auto px-4 pb-4 sm:px-6 lg:grid lg:grid-cols-5 lg:overflow-visible">
        {customerScreens.map((s) => (
          <li key={s.title} className="w-[200px] shrink-0 snap-start lg:w-auto">
            <PhoneFrame src={s.image} alt={s.title} />
            <p className="mt-4 text-center text-[15px] font-bold">{s.title}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
