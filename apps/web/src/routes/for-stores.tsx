import { createFileRoute } from "@tanstack/react-router"
import { pageHead } from "~/lib/seo"
import { ShopLayout } from "~/components/shop-layout"
import { OwnersHero } from "~/components/hero"
import { Facts } from "~/components/facts"
import { HowItWorks } from "~/components/how-it-works"
import { Spotlights } from "~/components/spotlights"
import { OwnersBand } from "~/components/bands"

export const Route = createFileRoute("/for-stores")({
  head: () => pageHead({
    title: "Bring your shop online | Martly for store owners",
    description: "Martly puts your supermarket or kirana store online: your own shop address on martlyshop.in, orders on your phone, and your catalogue and prices set up for you.",
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
      <OwnersBand />
    </ShopLayout>
  )
}
