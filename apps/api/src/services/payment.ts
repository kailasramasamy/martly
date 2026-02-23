import crypto from "crypto";
import Razorpay from "razorpay";

const keyId = process.env.RAZORPAY_KEY_ID ?? "";
const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";

let razorpayInstance: Razorpay | null = null;

function getRazorpay(): Razorpay {
  if (!razorpayInstance) {
    if (!keyId || !keySecret) {
      throw Object.assign(new Error("Razorpay is not configured"), { statusCode: 503 });
    }
    razorpayInstance = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }
  return razorpayInstance;
}

export function isRazorpayConfigured(): boolean {
  return Boolean(keyId && keySecret);
}

export function getRazorpayKeyId(): string {
  return keyId;
}

export async function createRazorpayOrder(amountInPaise: number, orderId: string) {
  const rp = getRazorpay();
  return rp.orders.create({
    amount: amountInPaise,
    currency: "INR",
    receipt: orderId,
  });
}

export function verifyRazorpaySignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
): boolean {
  const body = `${razorpayOrderId}|${razorpayPaymentId}`;
  const expected = crypto
    .createHmac("sha256", keySecret)
    .update(body)
    .digest("hex");
  return expected === signature;
}
