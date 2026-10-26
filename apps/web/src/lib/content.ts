import type { IconName } from "~/components/icons"

export interface Fact {
  icon: IconName
  title: string
  body: string
}

export const facts: Fact[] = [
  { icon: "store", title: "Packed by your shopkeeper", body: "The store you know, not a warehouse" },
  { icon: "wallet", title: "UPI, cards or cash", body: "Pay online or when it arrives" },
  { icon: "bike", title: "Delivery or pickup", body: "Get it home, or collect it yourself" },
  { icon: "language", title: "English or தமிழ்", body: "Shop in the language you like" },
]

export interface Step {
  icon: IconName
  title: string
  body: string
}

export const steps: Step[] = [
  { icon: "pin", title: "Choose your town", body: "See the stores in your town that deliver to your door." },
  { icon: "basket", title: "Fill your basket", body: "Browse the store's aisles, search by voice, or reorder what you bought last time." },
  { icon: "bike", title: "Delivered or picked up", body: "The store packs your order and brings it home, or keeps it ready for you to collect." },
]

export interface Spotlight {
  kicker: string
  title: string
  body: string
  chips: string[]
  image: string
  alt: string
}

/** Feature rows beside app screenshots; screenshots live in public/screenshots */
export const spotlights: Spotlight[] = [
  {
    kicker: "Home",
    title: "Your weekly shop, already half done.",
    body: "Martly remembers what you buy. Your regulars come back to the top, so the monthly list takes a few taps.",
    chips: ["Buy again in one tap", "Offers from your store", "Search by voice", "Festival specials"],
    image: "/screenshots/home.webp",
    alt: "Martly app home screen with Buy Again",
  },
  {
    kicker: "Choose",
    title: "Every pack size, side by side.",
    body: "One product, every size the store stocks. Compare 50 g against 300 g and add the one that suits you.",
    chips: ["All sizes in one sheet", "Price for each size", "Real product photos", "Save to your wishlist"],
    image: "/screenshots/sizes.webp",
    alt: "Choosing a pack size in the Martly app",
  },
  {
    kicker: "Checkout",
    title: "Pay how you like. Get it how you like.",
    body: "Pick home delivery or store pickup, then pay by UPI, card or cash on delivery. Fees are clear before you pay.",
    chips: ["Delivery or store pickup", "UPI and cards", "Cash on delivery", "Coupons and points"],
    image: "/screenshots/checkout.webp",
    alt: "Martly checkout with delivery and payment options",
  },
  {
    kicker: "In your language",
    title: "Shop in English or தமிழ்.",
    body: "Menus, aisles and product names switch to Tamil in a tap, so everyone at home can order.",
    chips: ["Full Tamil app", "Tamil product names", "Switch any time", "Speak your list in Tamil"],
    image: "/screenshots/tamil.webp",
    alt: "The Martly app in Tamil",
  },
]

export interface Faq {
  q: string
  a: string
}

export function faqs(townNames: string[]): Faq[] {
  const towns = townNames.length ? townNames.join(", ") : "Dharmapuri"
  return [
    { q: "What is Martly?", a: "Martly puts the stores in your town online. You order from a shop near you, and that shop packs and delivers your order." },
    { q: "Which towns is Martly in?", a: `Martly is live in ${towns}, with more towns joining. Pick your town at the top of the page to see who delivers to you.` },
    { q: "How do I pay?", a: "Pay online with UPI or a card, or pay cash when your order arrives." },
    { q: "Who delivers my order?", a: "The store you ordered from delivers it with its own delivery staff. You can also pick your order up from the store." },
    { q: "Can I shop in Tamil?", a: "Yes. The Martly app works fully in Tamil, including product names." },
    { q: "How do I put my store on Martly?", a: "Talk to us and we set up your shop, catalogue and prices, so your customers can order from you online." },
  ]
}
