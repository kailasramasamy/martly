# UPI app payments (Google Pay / PhonePe / Paytm)

Customers pay by tapping the UPI app they already use, instead of typing a UPI ID (Razorpay deprecated UPI Collect on 28 Feb 2026).

## Flow

1. **Checkout picker** (`components/checkout/PaymentOptions.tsx`) lists the UPI apps installed on the phone (`useInstalledUpiApps` in `lib/upi-apps.ts`, via `Linking.canOpenURL`), then "Other UPI apps, cards & more" (full Razorpay sheet), then COD / Pay at store.
2. The choice is remembered per device (`AsyncStorage` key `martly_payment_choice`). With no saved choice: account preference COD → COD, otherwise the first installed UPI app.
3. Placing an online order calls `POST /orders/:id/payment` (now returns `upi_s2s`).
   - **S2S on** (`RAZORPAY_UPI_S2S=true`) and a UPI app chosen → `POST /orders/:id/payment/upi-intent` returns Razorpay's `upi://pay?…` link; the app rewrites it to the app's scheme (`tez://upi/pay`, `phonepe://pay`, `paytmmp://pay`) and opens it directly. On return, `lib/use-upi-payment.ts` polls `GET /orders/:id/payment/status` every 2s (60s max) behind a "Confirming your payment" overlay.
   - **S2S off, or the S2S call fails** → Razorpay's standard sheet opens narrowed to UPI apps (`upiAppPackage` on `RazorpayCheckout`).
   - "Other" → full Razorpay sheet, UPI apps block first (`checkoutConfig` in `RazorpayCheckout.tsx`; also applies to membership and Tomorrow's Basket).
4. **Settlement** — `settleOrderPayment` (`apps/api/src/services/order-payment.ts`) is shared by the signature verify route, the status poll and the `order.paid` webhook. It's an atomic conditional update, so concurrent callers settle once.

## Native config

- iOS: `LSApplicationQueriesSchemes` in `app.json` (Razorpay's list).
- Android: `plugins/with-upi-queries.js` adds `<queries>` for the `upi` scheme and the GPay/PhonePe/Paytm packages (Android 11+ package visibility).
- Needs a fresh native build (`expo prebuild` / EAS); OTA updates don't carry it. App version 1.0.5 (iOS build 6).

## Turning on S2S

1. Ask Razorpay support to enable **S2S UPI Intent** on the live account.
2. Ensure the Razorpay webhook subscribes to `order.paid`.
3. Set `RAZORPAY_UPI_S2S=true` on Railway. No app release needed.

## Tested

- `tsc` passes for the API; mobile has no new type errors (`referral.tsx` errors pre-exist).
- curl: `/payment` returns `upi_s2s:false`; `/payment/status` → `PENDING`; `/payment/upi-intent` with the flag off → 400.
- Signed `order.paid` webhook settles a customer order; 3 concurrent deliveries → one settle, one status log.
- `expo config --type introspect`: manifest contains the UPI queries, Info.plist contains the schemes.

## Needs manual verification (real device, native build)

- Picker shows only installed apps on Android and iPhone; last choice preselected next time.
- Standard path: Razorpay sheet shows only UPI apps; check whether the `apps` restriction narrows it to the picked app (undocumented key — drop it if ignored).
- S2S path after enablement: app opens directly; `paytmmp://pay` works for Paytm on iOS; order turns PAID by poll, and by webhook if the app is killed mid-payment.
- `createUpiIntentPayment` against live Razorpay (users without email use `void@razorpay.com`; users without a phone fall back to the sheet).
