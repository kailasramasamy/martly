import { createFileRoute } from "@tanstack/react-router"
import { pageHead } from "~/lib/seo"
import { ownerFaqs } from "~/lib/content"
import { ShopLayout } from "~/components/shop-layout"
import { OwnersHero } from "~/components/hero"
import { Facts } from "~/components/facts"
import { HowItWorks } from "~/components/how-it-works"
import { Spotlights } from "~/components/spotlights"
import { CustomerScreens } from "~/components/customer-screens"
import { PricingStrip } from "~/components/pricing"
import { FaqSection } from "~/components/faq"
import { OwnersBand } from "~/components/bands"

export const Route = createFileRoute("/for-stores/")({
  head: () => pageHead({
    title: "Bring your shop online | Martly for store owners",
    description: "Martly puts your supermarket or kirana store online: 20,000 products ready to sell, orders and delivery from your phone, offers in one tap, in English and Tamil.",
    path: "/for-stores",
  }),
  component: ForStoresPage,
})

function ForStoresPage() {
  return (
    <ShopLayout store={null}>
      <OwnersHero />
      <Facts />
      <HowItWorks />
      <Spotlights />
      <CustomerScreens />
      <PricingStrip />
      <FaqSection items={ownerFaqs} title="Questions store owners ask" />
      <OwnersBand />
    </ShopLayout>
  )
}
