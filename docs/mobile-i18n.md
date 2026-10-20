# Mobile app languages (UI strings)

The customer app shows its whole interface in Tamil when the shopper picks தமிழ் under Account → Language. English is the default and the fallback. Kannada, Telugu and Hindi translate product data only and keep the English interface until they get string catalogs.

Staff and rider screens (`app/(manage)`, `app/manage`, `components/manage`) stay English for now.

## How it works

- `lib/i18n/en/<namespace>.ts` holds the English strings. It is the source of truth.
- `lib/i18n/ta/<namespace>.ts` is the Tamil catalog. It is typed `Strings<"namespace">`, so `tsc` fails if a key is missing or a function's signature differs.
- `useStrings("namespace")` (`lib/i18n/use-strings.ts`) returns the strings in the shopper's language and re-renders when the language changes.
- `strings("namespace")` (`lib/i18n/index.ts`) is the same lookup for plain helpers that run during render, such as status label maps.
- `formatDate` and `formatTime` (`lib/i18n/format.ts`) format dates in the shopper's language. Never call `toLocaleDateString` directly.
- Product, category and collection names come from the API's `translations` JSON. Show them with `getLocalizedName` from `useLanguage()`, not with UI strings.

### Fonts

Text styles use the `App-Regular`, `App-Medium`, `App-SemiBold`, `App-Bold` and `App-ExtraBold` family names, which `lib/font-patch.ts` injects. At launch, `lib/i18n/fonts.ts` loads Manrope under those names, or Noto Sans Tamil in Tamil. Manrope has no Tamil letters, and Noto Sans Tamil covers Tamil and Latin in every weight.

Because fonts load once, switching into or out of Tamil restarts the app with `expo-updates` `reloadAsync()`. That needs a native build that includes expo-updates.

## Adding a string

1. Add the key to `en/<ns>.ts` and copy the current English exactly.
2. Add the same key to `ta/<ns>.ts`.
3. In the component, call `const t = useStrings("<ns>")` and render `{t.key}`.

Text with numbers or names in it becomes a function, which also handles plurals:

```ts
// en
itemsInCart: (n: number) => (n === 1 ? "1 item in cart" : `${n} items in cart`),
belowMinimum: (more: string, min: string) => `Add ₹${more} more to place your order (min ₹${min})`,
// ta
itemsInCart: (n: number) => `கார்ட்டில் ${n} பொருட்கள்`,
```

Word order differs between the languages, so put the whole sentence in one function. Never glue fragments together in JSX. Shared words such as Add, Cancel, Retry, FREE, `n items` and `n% OFF` live in `common`.

## Namespaces

| Namespace | Covers |
|---|---|
| common | Shared buttons and words |
| nav | Tab labels and root stack header titles |
| cart | Cart tab |
| language | Language settings |
| home | Home tab, store discovery, festival, collection, deals, banners |
| catalog | Product, category, brand, product cards, variants, recipes |
| search | Search, store page, choose-store, location |
| checkout | Checkout, payment, order success, coupons |
| orders | Orders tab, order details, returns, live tracking, reviews |
| account | Account tab, wallet, loyalty, referral, membership, notifications, wishlist, delete account |
| subscriptions | Subscriptions, tomorrow's basket, smart reorder, AI order, support |
| auth | Login, sign-in prompts, gates, splash, confirm sheet, app-wide toasts |

## Tamil glossary

Use these terms everywhere so the app reads consistently.

| English | Tamil |
|---|---|
| Cart | கார்ட் |
| Add | சேர் |
| Checkout / Place order | ஆர்டர் செய் |
| Order / Orders | ஆர்டர் / ஆர்டர்கள் |
| Delivery | டெலிவரி |
| Delivery fee | டெலிவரி கட்டணம் |
| Free | இலவசம் |
| Wallet | வாலட் |
| Offers / Deals | சலுகைகள் |
| Discount / OFF | தள்ளுபடி |
| Search | தேடு |
| Account | கணக்கு |
| Store | கடை |
| Product | பொருள் |
| Category | வகை |
| Price | விலை |
| Total | மொத்தம் |
| Out of stock | ஸ்டாக் இல்லை |
| Cash on delivery | டெலிவரியில் பணம் |
| Pay online | ஆன்லைனில் செலுத்து |
| Coupon | கூப்பன் |
| Address | முகவரி |
| Sign in | உள்நுழை |
| Subscription | சந்தா |
| Return | திருப்பி அனுப்பு |
| Refund | பணத்தைத் திரும்பப் பெறுதல் |
| Placed | வைக்கப்பட்டது |
| Confirmed | உறுதி செய்யப்பட்டது |
| Packing / Packed | பேக் ஆகிறது / பேக் ஆனது |
| On the way / Out for delivery | வழியில் / டெலிவரிக்கு வருகிறது |
| Delivered | டெலிவரி ஆனது |
| Cancelled | ரத்து செய்யப்பட்டது |

Brand and product names (Martly, Mart Plus, Google Pay) are written in Tamil script, for example மார்ட்லி and மார்ட் பிளஸ். Amounts keep the `₹1,234` format with Latin digits, and units stay as they are (kg, g, ml). Use plain, polite spoken Tamil and address the shopper with the polite forms (உங்கள், செய்யுங்கள்).

## Not translated yet

- Server-sent text: API error messages, push notifications, SMS and invoices. These need Accept-Language support in the API.
- Product descriptions (data).
- Home section labels stored in the section config, such as offer labels and price-band labels.
