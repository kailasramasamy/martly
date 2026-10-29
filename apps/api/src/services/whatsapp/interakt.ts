// WhatsApp messages through Interakt (https://www.interakt.shop): approved templates sent to a shopper's number
const SEND_URL = "https://api.interakt.ai/v1/public/message/";

export interface TemplateMessage {
  /** 10-digit Indian mobile number */
  phone: string;
  template: string;
  language: string;
  /** Values for the template's {{1}}, {{2}}… in order */
  bodyValues: string[];
  /** Comes back on Interakt's delivery webhooks */
  callbackData?: string;
}

export type SendResult = { sent: true } | { sent: false; reason: "disabled" | "failed"; detail?: string };

/**
 * Sends one template message. Without INTERAKT_API_KEY, or with DISABLE_WHATSAPP=true (always set locally: the local
 * database holds real customers), it only logs what it would have sent.
 */
export async function sendTemplate(message: TemplateMessage, log: (msg: string) => void): Promise<SendResult> {
  const key = process.env.INTERAKT_API_KEY;
  if (!key || process.env.DISABLE_WHATSAPP === "true") {
    log(`Interakt (disabled): ${message.template} to ${message.phone.slice(-4).padStart(10, "•")} [${message.bodyValues.join(" | ")}]`);
    return { sent: false, reason: "disabled" };
  }
  const response = await fetch(SEND_URL, {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    headers: { Authorization: `Basic ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      countryCode: "+91",
      phoneNumber: message.phone.replace(/\D/g, "").slice(-10),
      callbackData: message.callbackData,
      type: "Template",
      template: { name: message.template, languageCode: message.language, bodyValues: message.bodyValues },
    }),
  });
  if (response.ok) return { sent: true };
  return { sent: false, reason: "failed", detail: `${response.status} ${(await response.text()).slice(0, 200)}` };
}
