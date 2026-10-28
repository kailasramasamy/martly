import { createFileRoute } from "@tanstack/react-router"
import { pageHead } from "~/lib/seo"
import { ShopLayout } from "~/components/shop-layout"
import { OwnersBand } from "~/components/bands"
import { CommissionBand, OneTimeCharges, PlanCards, PricingNotes } from "~/components/pricing"

export const Route = createFileRoute("/for-stores/pricing")({
  head: () => pageHead({
    title: "Pricing for store owners | Martly",
    description: "Martly store pricing: a free plan, Growth at ₹999 and Pro at ₹2,499 a month, 2% to 4% per order, ₹5,000 onboarding and free listing for popular brands.",
    path: "/for-stores/pricing",
  }),
  component: PricingPage,
})

function PricingPage() {
  return (
    <ShopLayout store={null}>
      <div className="mx-auto grid max-w-6xl gap-12 px-4 pt-12 sm:px-6 sm:pt-16">
        <header>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-brand">For store owners</p>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight sm:text-5xl">Store pricing</h1>
          <p className="mt-3 text-lg text-muted">Simple prices, all in rupees. Start free and upgrade when you want promotions.</p>
        </header>
        <CommissionBand />
        <PlanCards />
        <OneTimeCharges />
        <PricingNotes />
      </div>
      <OwnersBand />
    </ShopLayout>
  )
}
