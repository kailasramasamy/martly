import { fontFamily } from "../theme";

export type Line = { text: string; highlight?: boolean };
export type Tile = { label: string; value: string; note: string };

export const en = {
  font: fontFamily,
  captionScale: 1,
  captionTracking: -2,
  hookSource: "Another app · now",
  hook: [
    { text: "Your customers are" },
    { text: "ordering online…" },
    { text: "from someone else.", highlight: true },
  ],
  hookNotifications: [
    "Order placed on another app ✓",
    "Your delivery is 10 mins away",
    "₹40 off your next order — elsewhere",
  ],
  online: [{ text: "Bring your store online" }, { text: "on Martly.", highlight: true }],
  onlineStores: [
    { name: "The Fresh Pantry", tagline: "Premium grocer", yours: true },
    { name: "Annai Supermarket", tagline: "Supermarket" },
    { name: "Sri Murugan Stores", tagline: "Neighbourhood store" },
  ],
  storeBadge: "Now taking orders",
  ownApp: [{ text: "Prefer your own app?" }, { text: "We'll build it for you.", highlight: true }],
  ownAppTag: "Optional add-on",
  ownAppName: "Nalam Fresh",
  catalog: [{ text: "Get online fast." }, { text: "Catalog ready.", highlight: true }],
  catalogCount: 20000,
  catalogCountLabel: "products ready to sell",
  catalogSteps: ["Pick", "Price", "Go live"],
  snap: [{ text: "Local or homemade items?" }, { text: "Snap a photo — listed.", highlight: true }],
  snapProduct: { name: "Homemade Kai Murukku", detail: "250 g · \u20B9120 · Snacks", image: "local/kai-murukku-103e6a45.webp" },
  listed: "Listed ✓",
  shopHome: "screens/01-home.png",
  shop: [{ text: "Customers shop" }, { text: "your full store", highlight: true }],
  pay: [{ text: "Pay by UPI" }, { text: "or cash on delivery", highlight: true }],
  track: [{ text: "Every order" }, { text: "tracked live", highlight: true }],
  language: [{ text: "Tamil & English" }, { text: "for every customer", highlight: true }],
  manage: [{ text: "Run your store" }, { text: "from your phone", highlight: true }],
  stockAlert: [{ text: "Know what's" }, { text: "running low", highlight: true }],
  orders: [{ text: "Every order," }, { text: "one screen.", highlight: true }],
  promos: [{ text: "Promotions in minutes." }, { text: "Ads designed by Martly.", highlight: true }],
  promoBrief: "Diwali sweets — kaju katli, laddoo",
  promoPush: { title: "Diwali Sweets 🪔", body: "Kaju katli, laddoo & more" },
  promoBanners: ["banners/local-poster_moody-dark.webp", "banners/local-headline-top_pastel-minimal.webp"],
  grow: [{ text: "Offers & loyalty that" }, { text: "bring them back.", highlight: true }],
  growTiles: [
    { label: "Coupons", value: "FESTIVE20", note: "20% off this Diwali" },
    { label: "Loyalty", value: "+45 pts", note: "on every order" },
    { label: "Wallet", value: "\u20B9200", note: "cashback credited" },
    { label: "Subscriptions", value: "Milk · 6 AM", note: "delivered daily" },
  ] as Tile[],
  cta: [{ text: "Start selling online" }, { text: "on Martly", highlight: true }],
  ctaContact: "+91 99021 78682",
  ctaSite: "quartex.in",
  ctaFooter: "Simple, transparent pricing",
  musicCredit: "Music: “Dance” by Infraction (CC BY 3.0)",
};

export type Copy = typeof en;
