import { COMMISSION, EXTRA_PROMOTION, LISTING, ONBOARDING, PLANS, PRICING_NOTES, WEBSITE_LINK, type Plan } from "~/lib/pricing"
import { rupees } from "~/lib/format"
import { Icon } from "./icons"

/** The short pricing teaser on /for-stores: plan prices and commission, linking to the full page */
export function PricingStrip() {
  return (
    <section aria-labelledby="pricing-strip" className="mx-auto max-w-7xl px-4 pt-20 sm:px-6 sm:pt-24">
      <div className="flex flex-col gap-8 rounded-[28px] border border-line p-8 sm:p-10 lg:flex-row lg:items-center">
        <div className="lg:w-[34%]">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">Pricing</p>
          <h2 id="pricing-strip" className="mt-3 text-3xl font-extrabold tracking-tight">Start free. Pay a small fee per order.</h2>
          <p className="mt-2 text-base text-muted">2% on cash and wallet orders, 4% on online payments. No fee when there's no order.</p>
        </div>
        <ul className="grid flex-1 grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <li key={p.name} className={`rounded-[20px] p-5 ${p.featured ? "bg-brand-tint ring-2 ring-brand" : "bg-surface"}`}>
              <span className="block text-[15px] font-bold">{p.name}</span>
              <span className="mt-1 block text-2xl font-extrabold tabular-nums sm:text-3xl">{rupees(p.monthly)}</span>
              <span className="block text-[13px] text-muted">a month</span>
            </li>
          ))}
        </ul>
        <a href="/for-stores/pricing" className="inline-flex h-[52px] shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-7 font-extrabold text-white hover:bg-brand-deep">
          See full pricing <Icon name="arrow" size={18} />
        </a>
      </div>
    </section>
  )
}

export function CommissionBand() {
  return (
    <section aria-label="Commission on orders" className="grid overflow-hidden rounded-[20px] bg-brand-deep text-white sm:grid-cols-[1.4fr_1fr_1fr]">
      <div className="p-6 sm:p-7">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-teal-200">On every plan</p>
        <h2 className="mt-1 text-xl font-extrabold">A small fee only when you get an order</h2>
        <p className="mt-1.5 text-[14px] leading-relaxed text-teal-100">Covers payment gateway charges. GST included. Refunded if the order is returned. Payouts to your bank every week.</p>
      </div>
      {COMMISSION.map((c) => (
        <div key={c.rate} className="border-t border-white/15 p-6 sm:border-l sm:border-t-0 sm:p-7">
          <span className="block text-4xl font-extrabold">{c.rate}</span>
          <span className="mt-2 block text-[14px] text-teal-100">{c.label}</span>
        </div>
      ))}
    </section>
  )
}

function Ticks({ items, muted }: { items: string[]; muted?: boolean }) {
  return items.map((f) => (
    <li key={f} className={`flex gap-2.5 ${muted ? "text-muted" : ""}`}>
      <Icon name={muted ? "close" : "check"} size={17} className={`mt-0.5 shrink-0 ${muted ? "text-slate-400" : "text-brand"}`} />
      {f}
    </li>
  ))
}

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <article className={`relative flex flex-col gap-5 rounded-[20px] border p-7 ${plan.featured ? "border-2 border-brand" : "border-line"}`}>
      {plan.featured && <span className="absolute -top-3 left-6 rounded-full bg-amber px-3 py-1 text-xs font-extrabold uppercase tracking-wider text-amber-ink">Most stores</span>}
      <div>
        <h3 className="text-xl font-extrabold">{plan.name}</h3>
        <p className="text-[14px] text-muted">{plan.pitch}</p>
      </div>
      <div>
        <span className="text-4xl font-extrabold tabular-nums">{rupees(plan.monthly)}</span>
        <span className="text-[14px] text-muted"> / month</span>
        <p className="mt-1 text-[13px] text-muted tabular-nums">
          {plan.yearly ? <><b className="font-semibold text-brand">{rupees(plan.yearly)} / year</b> · 2 months free</> : "Free for as long as you like"}
        </p>
      </div>
      <p className="flex items-baseline gap-2 rounded-xl bg-brand-tint px-4 py-3">
        <span className="text-2xl font-extrabold text-brand">{plan.promotions}</span>
        <span className="text-[14px] font-semibold">{plan.promotions ? "promotions a month" : "promotions"}</span>
      </p>
      <ul className="grid gap-2.5 text-[15px]">
        <Ticks items={plan.features} />
        {plan.missing && <Ticks items={plan.missing} muted />}
      </ul>
    </article>
  )
}

export function PlanCards() {
  return (
    <section aria-labelledby="plans">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="plans" className="text-2xl font-extrabold tracking-tight">Monthly plans</h2>
        <p className="text-[14px] text-muted">One plan covers every store in your business. Pay yearly and get 2 months free.</p>
      </div>
      <div className="mt-6 grid gap-5 md:grid-cols-3">
        {PLANS.map((p) => <PlanCard key={p.name} plan={p} />)}
      </div>
      <div className="mt-5 flex flex-col gap-4 rounded-[20px] border border-dashed border-line p-6 sm:flex-row sm:items-center">
        <h3 className="shrink-0 text-base font-extrabold">What is a promotion?</h3>
        <p className="flex-1 text-[14px] leading-relaxed text-muted">
          A 7-day offer on products you choose. Martly creates the Home banner in English and Tamil and an offer page, and sends a notification to your customers. The sale price turns off by itself when the offer ends. Unused monthly promotions don't carry over.
        </p>
        <div className="shrink-0 sm:text-right">
          <span className="block text-2xl font-extrabold tabular-nums">{rupees(EXTRA_PROMOTION)}</span>
          <span className="block text-[13px] text-muted">per extra promotion, Growth and Pro</span>
        </div>
      </div>
    </section>
  )
}

export function OneTimeCharges() {
  return (
    <section aria-label="One-time charges" className="grid gap-5 md:grid-cols-2">
      <div className="rounded-[20px] border border-line p-7">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">One-time</p>
        <h2 className="mt-1 text-xl font-extrabold">Onboarding</h2>
        <p className="mt-4 text-3xl font-extrabold tabular-nums">{rupees(ONBOARDING.price)}</p>
        <ul className="mt-5 grid gap-2.5 text-[15px]"><Ticks items={ONBOARDING.includes} /></ul>
      </div>
      <div className="rounded-[20px] border border-line p-7">
        <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Per product</p>
        <h2 className="mt-1 text-xl font-extrabold">Product listing</h2>
        <dl className="mt-4 divide-y divide-line">
          {LISTING.map((l) => (
            <div key={l.title} className="flex justify-between gap-4 py-3.5">
              <dt>
                <span className="block text-[15px] font-semibold">{l.title}</span>
                <span className="block text-[13px] text-muted">{l.body}</span>
              </dt>
              <dd className={`shrink-0 font-extrabold ${l.cost === "Free" ? "text-brand" : ""}`}>{l.cost}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="flex flex-col gap-5 rounded-[20px] border border-line p-7 md:col-span-2 lg:flex-row lg:items-center lg:gap-10">
        <div className="lg:w-[40%]">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-brand">Add-on · one-time</p>
          <h2 className="mt-1 text-xl font-extrabold">Website link-up</h2>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">{WEBSITE_LINK.pitch}</p>
        </div>
        <ul className="grid flex-1 gap-2.5 text-[15px]"><Ticks items={WEBSITE_LINK.includes} /></ul>
        <p className="shrink-0 text-3xl font-extrabold tabular-nums">{rupees(WEBSITE_LINK.price)}</p>
      </div>
    </section>
  )
}

export function PricingNotes() {
  return (
    <ul className="grid gap-x-8 gap-y-2 border-t border-line pt-6 text-[13px] text-muted sm:grid-cols-2">
      {PRICING_NOTES.map((n) => <li key={n}>{n}</li>)}
    </ul>
  )
}
