import crypto from "crypto";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { getMarketingConfig } from "./config.js";
import type { BillingSnapshot } from "./billing.js";

const LINK_TTL_MS = 15 * 60 * 1000;
const secret = () => process.env.JWT_SECRET ?? "dev-secret-change-me";
const sign = (orderId: string, expires: number) => crypto.createHmac("sha256", secret()).update(`invoice:${orderId}:${expires}`).digest("hex");

/** A link that opens the invoice in any browser for 15 minutes, so apps can hand it to the system browser */
export function invoiceLink(orderId: string) {
  const expires = Date.now() + LINK_TTL_MS;
  return `/api/v1/marketing/invoices/${orderId}?expires=${expires}&sig=${sign(orderId, expires)}`;
}

export function invoiceLinkValid(orderId: string, expires: number, sig: string) {
  if (!Number.isFinite(expires) || expires < Date.now()) return false;
  const expected = Buffer.from(sign(orderId, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const inr = (n: unknown) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A printable GST tax invoice for a paid order; null when it doesn't exist or isn't paid */
export async function renderInvoice(prisma: PrismaClient, orderId: string) {
  const order = await prisma.adOrder.findUnique({ where: { id: orderId }, include: { product: true } });
  if (!order || order.status !== "PAID" || !order.number) return null;
  const config = await getMarketingConfig(prisma);
  const buyer = order.billing as unknown as BillingSnapshot;
  const taxRows = order.igst.toNumber() > 0
    ? `<tr><td>IGST @ ${order.gstPercent}%</td><td>${inr(order.igst)}</td></tr>`
    : `<tr><td>CGST @ ${Number(order.gstPercent) / 2}%</td><td>${inr(order.cgst)}</td></tr><tr><td>SGST @ ${Number(order.gstPercent) / 2}%</td><td>${inr(order.sgst)}</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Invoice ${esc(order.number)}</title>
<style>body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:760px;margin:24px auto;padding:0 16px}
h1{font-size:22px;margin:0}table{width:100%;border-collapse:collapse;margin-top:16px}td,th{padding:8px;border-bottom:1px solid #e2e8f0;text-align:left}
td:last-child,th:last-child{text-align:right}.grid{display:flex;gap:24px;flex-wrap:wrap;margin-top:16px}.grid div{flex:1;min-width:220px}
.muted{color:#64748b}.total td{font-weight:700;font-size:16px}@media print{button{display:none}}</style></head><body>
<h1>Tax invoice</h1><div class="muted">${esc(order.number)} · ${order.paidAt?.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</div>
<div class="grid"><div><b>${esc(config.sellerName)}</b><br>${esc(config.sellerAddress)}<br>${esc(config.sellerState)}${config.sellerGstin ? `<br>GSTIN ${esc(config.sellerGstin)}` : ""}</div>
<div><span class="muted">Billed to</span><br><b>${esc(buyer.name)}</b><br>${esc(buyer.address)}<br>${esc(buyer.state)}${buyer.gstin ? `<br>GSTIN ${esc(buyer.gstin)}` : ""}</div></div>
<table><tr><th>Item (SAC 998365, advertising services)</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
<tr><td>${esc(order.product.name)}</td><td>${order.quantity}</td><td>${inr(order.unitPrice)}</td><td>${inr(order.subtotal)}</td></tr></table>
<table><tr><td>Taxable value</td><td>${inr(order.subtotal)}</td></tr>${taxRows}<tr class="total"><td>Total</td><td>${inr(order.total)}</td></tr></table>
<p class="muted">Paid ${order.razorpayPaymentId ? `online (${esc(order.razorpayPaymentId)})` : `by transfer (${esc(order.offlineReference)})`}. Place of supply: ${esc(buyer.state ?? config.sellerState)}.</p>
<button onclick="print()">Print or save as PDF</button></body></html>`;
}
