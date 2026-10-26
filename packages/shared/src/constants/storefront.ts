// ── Storefront health ────────────────────────────────
// What makes a store's app look rich, how much each part counts, and where an owner turns it on

import { HERO_BUY_GET_MIN, HERO_COLLECTION_MIN, HERO_MOST_BOUGHT_PRODUCTS, HERO_RIGHT_NOW_MIN, type HeroCardKind } from "./home";

export const STOREFRONT_GROUPS = ["LOOKS", "HOME", "DEALS", "FRESH", "SERVICE"] as const;
export type StorefrontGroup = (typeof STOREFRONT_GROUPS)[number];

export const STOREFRONT_GROUP_LABELS: Record<StorefrontGroup, { en: string; ta: string }> = {
  LOOKS: { en: "Shop looks", ta: "கடையின் தோற்றம்" },
  HOME: { en: "Home screen", ta: "முகப்புத் திரை" },
  DEALS: { en: "Deals", ta: "சலுகைகள்" },
  FRESH: { en: "Fresh content", ta: "புதிய தகவல்" },
  SERVICE: { en: "Service & loyalty", ta: "சேவை & விசுவாசம்" },
};

/** What the AI can draft for a check; the owner reviews every draft before anything goes live */
export type StorefrontAiAction = "BRANDING" | "POST" | "OFFER_PICKS" | "COLLECTION" | "PROMO";

type Text = { en: string; ta: string };

/** Plan allowances a feature can spend: promotion credits, or AI images for generated banners */
export type StorefrontAllowance = "PROMOTION" | "AI_IMAGES";

export interface StorefrontCheckMeta {
  group: StorefrontGroup;
  /** Relative weight; the score is out of the weights of the checks that apply to the store */
  weight: number;
  title: Text;
  /** What it is, in one line */
  what: Text;
  /** Why shoppers care, in one line */
  why: Text;
  /** Manage screen in the app that sets it up; `:storeId` is filled in */
  screen: string;
  /** Admin page; `:storeId` is filled in */
  adminPath: string;
  ai?: StorefrontAiAction;
  /** What a count of this check is of, as in "0 of 2 banners live" */
  unit?: Text;
  /** The marketing-plan allowance setting it up spends */
  uses?: StorefrontAllowance;
}

export const STOREFRONT_CHECKS = {
  LOGO: {
    group: "LOOKS", weight: 4,
    title: { en: "Shop logo", ta: "கடை லோகோ" },
    what: { en: "Your logo on the store card and at the top of the app", ta: "கடை அட்டையிலும் ஆப்பின் மேலும் உங்கள் லோகோ" },
    why: { en: "Shoppers recognise your shop at a glance", ta: "வாடிக்கையாளர்கள் உங்கள் கடையை உடனே அடையாளம் காண்பார்கள்" },
    screen: "/manage/storefront/branding", adminPath: "/stores/edit/:storeId",
  },
  COVER: {
    group: "LOOKS", weight: 4,
    title: { en: "Cover photo", ta: "முகப்புப் படம்" },
    what: { en: "A wide photo of your shop front", ta: "உங்கள் கடை முகப்பின் அகலமான படம்" },
    why: { en: "A real photo builds trust before the first order", ta: "உண்மையான படம் முதல் ஆர்டருக்கு முன்பே நம்பிக்கை தரும்" },
    screen: "/manage/storefront/branding", adminPath: "/stores/edit/:storeId",
  },
  TAGLINE: {
    group: "LOOKS", weight: 4,
    title: { en: "Tagline", ta: "வாசகம்" },
    what: { en: "One line under your name, like \"Fresh stock every morning\"", ta: "பெயருக்குக் கீழ் ஒரு வரி, \"தினமும் காலை புதிய சரக்கு\" போல" },
    why: { en: "Tells shoppers why to pick your shop", ta: "உங்கள் கடையை ஏன் தேர்வு செய்ய வேண்டும் என்று சொல்லும்" },
    screen: "/manage/storefront/branding", adminPath: "/stores/edit/:storeId", ai: "BRANDING",
  },
  HIGHLIGHTS: {
    group: "LOOKS", weight: 3,
    unit: { en: "highlights", ta: "சிறப்புகள்" },
    title: { en: "Highlights", ta: "சிறப்புகள்" },
    what: { en: "Three things you're known for, like \"Fresh produce\"", ta: "உங்கள் கடையின் மூன்று சிறப்புகள், \"புதிய காய்கறிகள்\" போல" },
    why: { en: "Shown on your store card when shoppers choose a store", ta: "கடை தேர்வின் போது உங்கள் அட்டையில் காட்டப்படும்" },
    screen: "/manage/storefront/branding", adminPath: "/stores/edit/:storeId", ai: "BRANDING",
  },
  POSTERS: {
    group: "LOOKS", weight: 3,
    title: { en: "Shop posters", ta: "கடை போஸ்டர்கள்" },
    what: { en: "Up to 3 posters on your store card, like this week's offers", ta: "கடை அட்டையில் 3 போஸ்டர்கள் வரை, இந்த வார சலுகைகள் போல" },
    why: { en: "Your store card stands out among nearby shops", ta: "அருகிலுள்ள கடைகளிடையே உங்கள் அட்டை தனித்துத் தெரியும்" },
    screen: "/manage/storefront/branding", adminPath: "/stores/edit/:storeId",
  },
  LOOSE_STAPLES: {
    group: "LOOKS", weight: 6,
    unit: { en: "aisles with loose staples", ta: "உதிரிப் பொருட்கள் உள்ள பிரிவுகள்" },
    title: { en: "Loose rice, dal and flour", ta: "உதிரி அரிசி, பருப்பு, மாவு" },
    what: { en: "Your own unbranded rice, dal, atta and spices, at your prices", ta: "உங்கள் விலையில் உங்கள் சொந்த அரிசி, பருப்பு, மாவு, மசாலா" },
    why: { en: "Most shoppers here buy staples loose; they lead their aisles in the app", ta: "இங்கு பெரும்பாலோர் இவற்றை உதிரியாக வாங்குவார்கள்; ஆப்பில் அவை முதலில் தெரியும்" },
    screen: "/manage/loose-staples", adminPath: "/store-products",
  },
  HERO_CARDS: {
    group: "HOME", weight: 9,
    unit: { en: "cards ready", ta: "அட்டைகள் தயார்" },
    title: { en: "Big cards at the top of Home", ta: "முகப்பின் மேல் பெரிய அட்டைகள்" },
    what: { en: "Swipeable cards for offers, bestsellers and specials", ta: "சலுகைகள், அதிகம் விற்பவை, சிறப்புகளுக்கான அட்டைகள்" },
    why: { en: "The first thing shoppers see. It shows from 2 cards; 4 keeps it lively", ta: "வாடிக்கையாளர் முதலில் பார்ப்பது. 2 அட்டைகளில் தெரியும்; 4 இருந்தால் நிறைவாக இருக்கும்" },
    screen: "/manage/storefront/hero-cards", adminPath: "/home-layout", ai: "COLLECTION",
  },
  BANNERS: {
    group: "HOME", weight: 7,
    unit: { en: "banners live", ta: "பேனர்கள் இயங்குகின்றன" },
    uses: "PROMOTION",
    title: { en: "Home banners", ta: "முகப்பு பேனர்கள்" },
    what: { en: "Your own picture banners on Home for your offers. Brand ads Martly runs don't count", ta: "உங்கள் சலுகைகளுக்கான உங்கள் சொந்த முகப்புப் பேனர்கள். Martly இயக்கும் பிராண்ட் விளம்பரங்கள் கணக்கில் வராது" },
    why: { en: "Banners are where shoppers tap first", ta: "வாடிக்கையாளர்கள் முதலில் தொடுவது பேனர்களைத்தான்" },
    screen: "/manage/promos/new", adminPath: "/promos/create", ai: "PROMO",
  },
  STORE_SPECIALS: {
    group: "HOME", weight: 4,
    uses: "AI_IMAGES",
    title: { en: "Store specials", ta: "கடையின் சிறப்புகள்" },
    what: { en: "A collection of what your shop is best at", ta: "உங்கள் கடையின் சிறந்த பொருட்களின் தொகுப்பு" },
    why: { en: "Gives your Home a personal touch", ta: "உங்கள் முகப்புக்குத் தனித்தன்மை தரும்" },
    screen: "/manage/collections/new", adminPath: "/collections/create", ai: "COLLECTION",
  },
  FESTIVAL: {
    group: "HOME", weight: 4,
    uses: "AI_IMAGES",
    title: { en: "Festival collection", ta: "பண்டிகைத் தொகுப்பு" },
    what: { en: "A ready-made collection for the coming festival", ta: "வரும் பண்டிகைக்கான தயார் தொகுப்பு" },
    why: { en: "Festival shoppers buy more when it's all in one place", ta: "எல்லாம் ஒரே இடத்தில் இருந்தால் பண்டிகைக்கு அதிகம் வாங்குவார்கள்" },
    screen: "/manage/collections/new", adminPath: "/collections/create", ai: "COLLECTION",
  },
  SECTIONS_SHOWING: {
    group: "HOME", weight: 3,
    unit: { en: "rows showing", ta: "வரிசைகள் தெரிகின்றன" },
    title: { en: "Home sections with enough products", ta: "போதுமான பொருட்களுடன் முகப்புப் பகுதிகள்" },
    what: { en: "Rows on Home hide when they have too few products", ta: "குறைந்த பொருட்கள் இருந்தால் முகப்பு வரிசைகள் மறையும்" },
    why: { en: "A fuller Home keeps shoppers browsing", ta: "நிறைந்த முகப்பு வாடிக்கையாளர்களைத் தொடர்ந்து பார்க்க வைக்கும்" },
    screen: "/manage/home-layout", adminPath: "/home-layout",
  },
  BUY_GET: {
    group: "DEALS", weight: 7,
    unit: { en: "offers running", ta: "சலுகைகள் நடப்பில்" },
    title: { en: "Buy X get Y offers", ta: "X வாங்கினால் Y இலவசம்" },
    what: { en: "Like \"Buy 2 Get 1 free\" on a product", ta: "ஒரு பொருளில் \"2 வாங்கினால் 1 இலவசம்\" போல" },
    why: { en: "3 or more add a Buy X get Y card at the top of Home", ta: "3 அல்லது அதற்கு மேல் இருந்தால் முகப்பின் மேல் அட்டை வரும்" },
    screen: "/manage/offers/new", adminPath: "/offers/create", ai: "OFFER_PICKS",
  },
  DISCOUNTS: {
    group: "DEALS", weight: 6,
    unit: { en: "products on discount", ta: "தள்ளுபடியில் பொருட்கள்" },
    title: { en: "Discounts", ta: "தள்ளுபடிகள்" },
    what: { en: "₹ or % off on products", ta: "பொருட்களில் ₹ அல்லது % தள்ளுபடி" },
    why: { en: "Discounted products fill the Deals rows on Home", ta: "தள்ளுபடிப் பொருட்கள் முகப்பின் சலுகை வரிசைகளை நிரப்பும்" },
    screen: "/manage/offers/new", adminPath: "/offers/create", ai: "OFFER_PICKS",
  },
  COUPON: {
    group: "DEALS", weight: 6,
    title: { en: "Coupon on Home", ta: "முகப்பில் கூப்பன்" },
    what: { en: "A coupon code shown in Home offers and at checkout", ta: "முகப்புச் சலுகைகளிலும் செக்அவுட்டிலும் காட்டப்படும் கூப்பன்" },
    why: { en: "A welcome coupon turns first visits into orders", ta: "வரவேற்பு கூப்பன் முதல் வருகையை ஆர்டராக மாற்றும்" },
    screen: "/manage/coupons/new", adminPath: "/coupons/create",
  },
  MEMBER_PRICE: {
    group: "DEALS", weight: 3,
    unit: { en: "products with a member price", ta: "உறுப்பினர் விலையுள்ள பொருட்கள்" },
    title: { en: "Member prices", ta: "உறுப்பினர் விலைகள்" },
    what: { en: "Lower prices for Mart Plus members", ta: "Mart Plus உறுப்பினர்களுக்குக் குறைந்த விலை" },
    why: { en: "Gives shoppers a reason to join your membership", ta: "உறுப்பினராகச் சேர ஒரு காரணம் தரும்" },
    screen: "/manage/offers/new", adminPath: "/offers/create",
  },
  PROMO: {
    group: "DEALS", weight: 3,
    uses: "PROMOTION",
    title: { en: "Promotion running", ta: "விளம்பரம் நடைபெறுகிறது" },
    what: { en: "A themed offer with its own banner and collection", ta: "தனி பேனர் மற்றும் தொகுப்புடன் ஒரு சிறப்புச் சலுகை" },
    why: { en: "Promotions bring shoppers back", ta: "விளம்பரங்கள் வாடிக்கையாளர்களைத் திரும்ப வர வைக்கும்" },
    screen: "/manage/promos/new", adminPath: "/promos/create", ai: "PROMO",
  },
  POST: {
    group: "FRESH", weight: 7,
    title: { en: "\"From the shop\" post", ta: "\"கடையிலிருந்து\" பதிவு" },
    what: { en: "A short note like \"Fresh vegetables in today\"", ta: "\"இன்று புதிய காய்கறிகள்\" போன்ற சிறு குறிப்பு" },
    why: { en: "Shows your shop is active today", ta: "உங்கள் கடை இன்று இயங்குவதைக் காட்டும்" },
    screen: "/manage/store-posts/new", adminPath: "/store-posts", ai: "POST",
  },
  PICKS: {
    group: "FRESH", weight: 4,
    unit: { en: "picks", ta: "தேர்வுகள்" },
    title: { en: "Owner's picks", ta: "உரிமையாளர் தேர்வுகள்" },
    what: { en: "Your personal recommendation on a product", ta: "ஒரு பொருளில் உங்கள் தனிப்பட்ட பரிந்துரை" },
    why: { en: "Shoppers trust a shopkeeper's word", ta: "கடைக்காரரின் சொல்லை வாடிக்கையாளர்கள் நம்புவார்கள்" },
    screen: "/manage/products", adminPath: "/products",
  },
  NEW_PRODUCTS: {
    group: "FRESH", weight: 4,
    unit: { en: "new products", ta: "புதிய பொருட்கள்" },
    title: { en: "New products", ta: "புதிய பொருட்கள்" },
    what: { en: "Products added in the last 2 weeks", ta: "கடந்த 2 வாரங்களில் சேர்த்த பொருட்கள்" },
    why: { en: "New items give regulars something to discover", ta: "புதிய பொருட்கள் வழக்கமான வாடிக்கையாளர்களுக்குப் புதுமை தரும்" },
    screen: "/manage/add-product", adminPath: "/store-products/create",
  },
  DELIVERY: {
    group: "SERVICE", weight: 4,
    title: { en: "Delivery options", ta: "டெலிவரி வசதிகள்" },
    what: { en: "Express delivery or delivery time slots", ta: "விரைவு டெலிவரி அல்லது டெலிவரி நேரங்கள்" },
    why: { en: "Shoppers order when they know when it arrives", ta: "எப்போது வரும் என்று தெரிந்தால் ஆர்டர் செய்வார்கள்" },
    screen: "/manage/delivery-slots", adminPath: "/delivery-slots",
  },
  FREE_DELIVERY: {
    group: "SERVICE", weight: 4,
    title: { en: "Free delivery above an amount", ta: "குறிப்பிட்ட தொகைக்கு மேல் இலவச டெலிவரி" },
    what: { en: "Like \"Free delivery above ₹299\"", ta: "\"₹299க்கு மேல் இலவச டெலிவரி\" போல" },
    why: { en: "Shoppers add more to reach it", ta: "அதை அடைய அதிகம் சேர்ப்பார்கள்" },
    screen: "/manage/stores/:storeId", adminPath: "/stores/edit/:storeId",
  },
  LOYALTY: {
    group: "SERVICE", weight: 3,
    title: { en: "Loyalty points", ta: "லாயல்டி புள்ளிகள்" },
    what: { en: "Points on every order, spent on the next", ta: "ஒவ்வொரு ஆர்டரிலும் புள்ளிகள், அடுத்ததில் பயன்படுத்தலாம்" },
    why: { en: "Brings shoppers back to your shop", ta: "வாடிக்கையாளர்களை உங்கள் கடைக்குத் திரும்ப வர வைக்கும்" },
    screen: "/manage/loyalty-settings", adminPath: "/loyalty-settings",
  },
  REFERRAL: {
    group: "SERVICE", weight: 2,
    title: { en: "Refer a friend", ta: "நண்பரைப் பரிந்துரை" },
    what: { en: "Shoppers earn when a friend orders", ta: "நண்பர் ஆர்டர் செய்தால் வாடிக்கையாளருக்கு வெகுமதி" },
    why: { en: "Your shoppers bring new shoppers", ta: "உங்கள் வாடிக்கையாளர்கள் புதியவர்களைக் கொண்டு வருவார்கள்" },
    screen: "/manage/referral-settings", adminPath: "/referral-settings",
  },
  MEMBERSHIP: {
    group: "SERVICE", weight: 2,
    title: { en: "Membership plan", ta: "உறுப்பினர் திட்டம்" },
    what: { en: "A paid plan with member prices and free delivery", ta: "உறுப்பினர் விலை, இலவச டெலிவரியுடன் கட்டணத் திட்டம்" },
    why: { en: "Members order more often", ta: "உறுப்பினர்கள் அடிக்கடி ஆர்டர் செய்வார்கள்" },
    screen: "/manage/membership-plans", adminPath: "/membership-plans",
  },
  REVIEWS: {
    group: "SERVICE", weight: 3,
    title: { en: "Reviews answered", ta: "மதிப்புரைகளுக்குப் பதில்" },
    what: { en: "New product reviews approved within 3 days", ta: "புதிய மதிப்புரைகள் 3 நாட்களுக்குள் அனுமதிக்கப்படுதல்" },
    why: { en: "Reviews help other shoppers decide", ta: "மதிப்புரைகள் மற்றவர்கள் முடிவெடுக்க உதவும்" },
    screen: "/manage/reviews", adminPath: "/reviews",
  },
} as const satisfies Record<string, StorefrontCheckMeta>;

export type StorefrontCheckKey = keyof typeof STOREFRONT_CHECKS;

// Minimums behind the checks
export const STOREFRONT_MIN = {
  HIGHLIGHTS: 3,
  /** Staple aisles (rice, dal, atta…) with at least one loose item listed */
  LOOSE_STAPLE_AISLES: 6,
  /** Ready hero cards; Home shows the carousel from 2, but a fuller one is the goal */
  HERO_CARDS: 4,
  BANNERS: 2,
  BUY_GET: 3,
  DISCOUNTS: 5,
  MEMBER_PRICES: 5,
  PICKS: 3,
  NEW_PRODUCTS: 5,
  NEW_PRODUCT_DAYS: 14,
  REVIEW_WAIT_DAYS: 3,
  /** A festival collection counts as due this many days before the festival's offers go live */
  FESTIVAL_AHEAD_DAYS: 21,
  /** A post that expired within this many days reads as stale rather than missing */
  POST_STALE_DAYS: 30,
} as const;

/** Where a hero card that isn't ready gets what it needs; self-filling cards have nothing to set up */
export type HeroCardFix = "OFFERS" | "STORE_SPECIAL" | "RIGHT_NOW" | "COLLECTION";

/** Each hero card in plain words, and what it needs before Home shows it */
export const HERO_CARD_GUIDE: Record<HeroCardKind, { name: Text; needs: Text; fix?: HeroCardFix }> = {
  FESTIVE: {
    name: { en: "Festival", ta: "திருவிழா" },
    needs: { en: "Turns on by itself in the days before a festival", ta: "திருவிழாவுக்கு முன் தானாக வரும்" },
  },
  BUY_GET: {
    name: { en: "Buy X get Y free", ta: "X வாங்கினால் Y இலவசம்" },
    needs: { en: `Needs ${HERO_BUY_GET_MIN} Buy X get Y offers`, ta: `${HERO_BUY_GET_MIN} "X வாங்கினால் Y இலவசம்" சலுகைகள் தேவை` },
    fix: "OFFERS",
  },
  MOST_BOUGHT: {
    name: { en: "Most bought", ta: "அதிகம் வாங்கப்பட்டவை" },
    needs: { en: `Turns on by itself once shoppers buy ${HERO_MOST_BOUGHT_PRODUCTS} different products in 30 days`, ta: `30 நாட்களில் வாடிக்கையாளர்கள் ${HERO_MOST_BOUGHT_PRODUCTS} வெவ்வேறு பொருட்கள் வாங்கியதும் தானாக வரும்` },
  },
  STORE_SPECIAL: {
    name: { en: "Store special", ta: "கடை சிறப்பு" },
    needs: { en: `Needs a store specials collection with ${HERO_COLLECTION_MIN} products in stock`, ta: `கையிருப்பில் ${HERO_COLLECTION_MIN} பொருட்களுடன் கடை சிறப்புத் தொகுப்பு தேவை` },
    fix: "STORE_SPECIAL",
  },
  RIGHT_NOW: {
    name: { en: "Right now", ta: "இப்போது" },
    needs: { en: `Needs a collection for this time of day, with ${HERO_RIGHT_NOW_MIN} products in stock`, ta: `இந்த நேரத்துக்கான தொகுப்பு, கையிருப்பில் ${HERO_RIGHT_NOW_MIN} பொருட்களுடன் தேவை` },
    fix: "RIGHT_NOW",
  },
  COLLECTION: {
    name: { en: "Collection", ta: "தொகுப்பு" },
    needs: { en: `Its collection needs ${HERO_COLLECTION_MIN} products in stock here`, ta: `இதன் தொகுப்பில் கையிருப்பில் ${HERO_COLLECTION_MIN} பொருட்கள் தேவை` },
    fix: "COLLECTION",
  },
};
