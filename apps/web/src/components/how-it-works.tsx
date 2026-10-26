import { steps } from "~/lib/content"
import { Icon } from "./icons"

export function HowItWorks() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-24">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">How it works</p>
      <h2 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-[34px]">Three steps from your list to your door.</h2>
      <ol className="mt-9 grid gap-5 md:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title} className="relative rounded-[20px] border border-line p-7">
            <span aria-hidden="true" className="absolute right-6 top-4 text-6xl font-extrabold text-slate-100">{i + 1}</span>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-tint text-brand ring-1 ring-brand/20">
              <Icon name={step.icon} size={22} />
            </span>
            <h3 className="mt-5 text-xl font-extrabold">{step.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-muted">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}
