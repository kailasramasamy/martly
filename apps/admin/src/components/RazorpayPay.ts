export interface RazorpayCheckout {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayInstance;
  }
}

const CHECKOUT_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";
let scriptLoad: Promise<void> | null = null;

function loadCheckoutScript(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  scriptLoad ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SCRIPT;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptLoad = null;
      script.remove();
      reject(new Error("Could not load the payment window"));
    };
    document.head.appendChild(script);
  });
  return scriptLoad;
}

export const PAYMENT_CANCELLED = "PaymentCancelled";

/** Opens Razorpay's checkout and resolves with the signed payment response; rejects with a PaymentCancelled error if the window is closed */
export async function payWithRazorpay(checkout: RazorpayCheckout, description: string): Promise<RazorpayResponse> {
  await loadCheckoutScript();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new Error("Could not load the payment window");
  return new Promise((resolve, reject) => {
    new Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: "Martly",
      description,
      handler: (response: RazorpayResponse) => resolve(response),
      modal: { ondismiss: () => reject(Object.assign(new Error("Payment cancelled"), { name: PAYMENT_CANCELLED })) },
    }).open();
  });
}
