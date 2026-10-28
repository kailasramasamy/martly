import type { IconName } from "~/components/icons"

export interface Fact {
  icon: IconName
  title: string
  body: string
}

/** The store-owner pitch on /for-stores; screenshots live in public/screenshots/owners */
export const facts: Fact[] = [
  { icon: "grid", title: "20,000 products ready", body: "Tick what you stock, no typing" },
  { icon: "language", title: "English and தமிழ்", body: "For you and your customers" },
  { icon: "wallet", title: "UPI, cards or cash", body: "Weekly payouts to your bank" },
  { icon: "bike", title: "Your customers, your staff", body: "You pack and deliver, as today" },
]

export interface Step {
  icon: IconName
  title: string
  body: string
  image: string
}

export const steps: Step[] = [
  { icon: "check", title: "Tick what you stock", body: "Go through the catalog by department and brand. Anything you don't carry is hidden.", image: "/screenshots/owners/stock-check.webp" },
  { icon: "tag", title: "Check your prices", body: "Keep the suggested price or change it. Best sellers come first, so you're ready in minutes.", image: "/screenshots/owners/price-review.webp" },
  { icon: "store", title: "Start taking orders", body: "Your shop goes live on the Martly app and martlyshop.in, with its own address.", image: "/screenshots/owners/orders.webp" },
]

export interface Spotlight {
  kicker: string
  title: string
  body: string
  chips: string[]
  image: string
  alt: string
}

export const spotlights: Spotlight[] = [
  {
    kicker: "Today",
    title: "Your whole shop on one screen.",
    body: "Open the app and see what needs you first: orders to pack, reviews to answer, and the money coming to your bank.",
    chips: ["What needs attention", "Today's revenue", "Next payout", "Live order queue"],
    image: "/screenshots/owners/today.webp",
    alt: "The Today screen in the Martly app",
  },
  {
    kicker: "Orders",
    title: "Every order, one list.",
    body: "New, confirmed, packing and ready. See who ordered, how they paid, and whether it's delivery or pickup.",
    chips: ["Paid or cash on delivery", "Delivery or pickup", "Search by order or customer", "Order alerts on your phone"],
    image: "/screenshots/owners/orders.webp",
    alt: "The Orders screen in the Martly app",
  },
  {
    kicker: "Inventory",
    title: "Stock and prices, always right.",
    body: "Mark items out of stock, change a price, or add your own products. Low stock shows up before customers notice.",
    chips: ["Low and out of stock", "Change prices any time", "Add your own products", "Sizes and variants"],
    image: "/screenshots/owners/inventory.webp",
    alt: "The Inventory screen in the Martly app",
  },
  {
    kicker: "Offers",
    title: "Run offers in one tap.",
    body: "Buy 1 Get 1, a discount, or a member price. Pick the products and the dates, and the offer ends by itself.",
    chips: ["Buy 1 Get 1 and more", "Discounts on products", "Member prices", "Coupons for the whole order"],
    image: "/screenshots/owners/offers.webp",
    alt: "The Offers screen in the Martly app",
  },
  {
    kicker: "Delivery",
    title: "Slots, riders and trips planned.",
    body: "Customers pick express or a time slot. You group orders into trips and see where each rider is.",
    chips: ["Express and time slots", "Trips planned for you", "Rider app with live tracking", "Store pickup too"],
    image: "/screenshots/owners/delivery.webp",
    alt: "The Delivery screen in the Martly app",
  },
  {
    kicker: "Storefront",
    title: "Martly shows what to fix next.",
    body: "Your storefront gets a score. Add a logo, a shop photo or your best picks, and watch more customers stay to shop.",
    chips: ["Storefront score", "Step-by-step tips", "Shop photo and logo", "Owner's picks"],
    image: "/screenshots/owners/storefront-score.webp",
    alt: "Storefront health in the Martly app",
  },
]

export interface Screen {
  title: string
  image: string
}

export const customerScreens: Screen[] = [
  { title: "Your shop's own Home", image: "/screenshots/owners/shop-home.webp" },
  { title: "Say the list, get a cart", image: "/screenshots/owners/shop-speak-list.webp" },
  { title: "Express or a time slot", image: "/screenshots/owners/shop-checkout-slots.webp" },
  { title: "Live order tracking", image: "/screenshots/owners/shop-tracking.webp" },
  { title: "Fully in Tamil", image: "/screenshots/owners/shop-tamil.webp" },
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

export const ownerFaqs: Faq[] = [
  { q: "Who delivers the orders?", a: "You do, with your own staff, as you do today. Martly plans the trips and your riders use the Martly rider app. Customers can also pick up from your shop." },
  { q: "What do I pay per order?", a: "2% on cash on delivery and wallet orders and 4% on online payments, including payment gateway charges and GST. Plans start free. See the pricing page for details." },
  { q: "How do I get paid for online orders?", a: "Online payments are settled to your bank account every week, after the order fee." },
  { q: "Do I need my own app?", a: "No. Your shop gets its own page on the Martly app and on martlyshop.in. If you'd like an app under your own shop's name, we can build one for you as an add-on." },
  { q: "Can I sell my own packs and local products?", a: "Yes. Popular brands are listed free. Your own brand and local products cost \u20B9100 each to list, and your first 25 are included with onboarding." },
  { q: "How do I get started?", a: "Talk to us. We set up your shop, then you tick what you stock and check prices in the app. You start taking orders as soon as that's done." },
]
