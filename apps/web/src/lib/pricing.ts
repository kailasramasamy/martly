/** Store pricing shown on /for-stores and /for-stores/pricing; amounts in rupees, before GST unless noted */

export const COMMISSION = [
  { rate: "2%", label: "Cash on delivery and wallet orders" },
  { rate: "4%", label: "Online payment orders (UPI, card)" },
]

export interface Plan {
  name: string
  pitch: string
  monthly: number
  yearly?: number
  promotions: number
  features: string[]
  missing?: string[]
  featured?: boolean
}

export const PLANS: Plan[] = [
  {
    name: "Free",
    pitch: "Get your store online",
    monthly: 0,
    promotions: 0,
    features: [
      "Your store on the Martly app and martlyshop.in",
      "Unlimited products and orders",
      "Delivery, pickup, online payment and cash on delivery",
      "Offers and discounts you set yourself",
    ],
    missing: ["Promotions and customer notifications"],
  },
  {
    name: "Growth",
    pitch: "Bring customers back every month",
    monthly: 999,
    yearly: 9990,
    promotions: 2,
    features: ["Everything in Free", "Offer notifications to your customers' phones", "Buy extra promotions any time"],
    featured: true,
  },
  {
    name: "Pro",
    pitch: "Run an offer every week",
    monthly: 2499,
    yearly: 24990,
    promotions: 6,
    features: ["Everything in Growth", "Lowest cost per promotion, about ₹416 each"],
  },
]

export const EXTRA_PROMOTION = 599

export const ONBOARDING = {
  price: 5000,
  includes: [
    "Store setup: logo, storefront, delivery area and timings",
    "Check of your product range and prices",
    "Your first 25 store-brand product listings",
    "3 months of Growth included (worth ₹2,997)",
  ],
}

export const LISTING = [
  { title: "Popular brands", body: "Martly adds them to the catalog, usually within 2 working days", cost: "Free" },
  { title: "Your own brand or local brands", body: "Photo, name in English and Tamil, sizes and price. First 25 included with onboarding.", cost: "₹100 each" },
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
  "Popular brand means a brand already in the Martly catalog or widely sold in shops.",
]
