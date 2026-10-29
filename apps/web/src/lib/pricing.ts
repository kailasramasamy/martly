import { CATALOG_SIZE_LABEL, LISTING_FEE, OWN_LISTINGS_INCLUDED } from "@martly/shared/constants"

/** Store pricing shown on /for-stores and /for-stores/pricing; amounts in rupees, before GST unless noted */

export const COMMISSION = [
  { rate: "2%", label: "Cash on delivery and wallet orders" },
  { rate: "4%", label: "Online payment orders (UPI, card)" },
]

export interface Plan {
  code: string
  name: string
  pitch: string
  monthly: number
  yearly?: number
  promotions: number
  features: string[]
  missing?: string[]
  featured?: boolean
}

/** A plan's listing lines: the free catalog, and how many of the store's own products it lists free */
function listings(code: string) {
  const own = `${OWN_LISTINGS_INCLUDED[code]} of your own or local products listed free`
  return code === "FREE" ? [`${CATALOG_SIZE_LABEL} catalog products listed free`, own] : [own]
}

export const PLANS: Plan[] = [
  {
    code: "FREE",
    name: "Free",
    pitch: "Get your store online",
    monthly: 0,
    promotions: 0,
    features: [
      "Your store on the Martly app",
      ...listings("FREE"),
      "Unlimited orders",
      "Delivery, pickup, online payment and cash on delivery",
      "Offers and discounts you set yourself",
      "Buy promotions when you need one",
    ],
    missing: ["Web store on martlyshop.in", "Monthly promotions and customer notifications"],
  },
  {
    code: "GROWTH",
    name: "Growth",
    pitch: "Bring customers back every month",
    monthly: 999,
    yearly: 9990,
    promotions: 2,
    features: ["Everything in Free", ...listings("GROWTH"), "Web store on martlyshop.in", "Offer notifications to your customers' phones", "Buy extra promotions any time"],
    featured: true,
  },
  {
    code: "PRO",
    name: "Pro",
    pitch: "Run an offer every week",
    monthly: 2499,
    yearly: 24990,
    promotions: 6,
    features: ["Everything in Growth", ...listings("PRO"), "Lowest cost per promotion, about ₹416 each"],
  },
]

export const EXTRA_PROMOTION = 599

export const ONBOARDING = {
  price: 5000,
  includes: [
    "Store setup: logo, storefront, delivery area and timings",
    "Check of your product range and prices",
    "3 months of Growth included (worth ₹2,997)",
  ],
}

export const LISTING = [
  { title: `${CATALOG_SIZE_LABEL} catalog products`, body: "Popular brands from the Martly catalog. Missing ones are added, usually within 2 working days.", cost: "Free" },
  { title: "Your own brand or local products", body: `Photo, name in English and Tamil, sizes and price. ${OWN_LISTINGS_INCLUDED.FREE} free on Free, ${OWN_LISTINGS_INCLUDED.GROWTH} on Growth, ${OWN_LISTINGS_INCLUDED.PRO} on Pro.`, cost: `₹${LISTING_FEE} each, one-time` },
  { title: "Price and stock changes", body: "Update from the app any time", cost: "Free" },
]

export const WEBSITE_LINK = {
  price: 1999,
  pitch: "Already have a website? Your web address opens your Martly shop, with your full range, prices and offers.",
  includes: [
    "Set up for you at your domain provider",
    "Email on your domain keeps working",
    "Customers order on the Martly app",
  ],
}

export const PRICING_NOTES = [
  "Plan prices, listing charges and add-ons are plus 18% GST. Order commission includes GST.",
  "Change or cancel your plan at the end of any month.",
  "Monthly promotions reset every month. Extra promotions stay until you use them.",
  "Included listings count once. Products you've listed stay listed if you change plans.",
  "Popular brand means a brand already in the Martly catalog or widely sold in shops.",
]
