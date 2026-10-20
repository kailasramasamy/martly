import { COMMISSION_GST_PCT, LedgerEntryTypeLabels, SettlementStatusLabels } from "@martly/shared/constants";
import type { PrismaClient } from "../../../generated/prisma/client.js";
import { signatureValid, signedQuery } from "../signed-link.js";

export function statementLink(settlementId: string) {
  return `/api/v1/ledger/statements/${settlementId}?${signedQuery("statement", settlementId)}`;
}

export const statementLinkValid = (id: string, expires: number, sig: string) => signatureValid("statement", id, expires, sig);

const esc = (s: string | null | undefined) =>
  (s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
const inr = (n: unknown) => `${Number(n) < 0 ? "−" : ""}₹${Math.abs(Number(n)).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (d: Date) => d.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric" });

type Line = { storeId: string | null; type: keyof typeof LedgerEntryTypeLabels; amount: unknown; memo: string; createdAt: Date };

/** Store → type → lines, so the owner sees what each store earned and gave back */
function storeSections(lines: Line[], storeNames: Map<string, string>) {
  const byStore = new Map<string, Line[]>();
  for (const l of lines) byStore.set(l.storeId ?? "", [...(byStore.get(l.storeId ?? "") ?? []), l]);
  return [...byStore].map(([storeId, rows]) => {
    const total = rows.reduce((n, r) => n + Number(r.amount), 0);
    const body = rows.map((r) => `<tr><td>${day(r.createdAt)}</td><td>${esc(LedgerEntryTypeLabels[r.type])}</td><td>${esc(r.memo)}</td><td>${inr(r.amount)}</td></tr>`).join("");
    const name = storeId ? storeNames.get(storeId) ?? "Store" : "Organization";
    return `<h2>${esc(name)} <span class="muted">${inr(total)}</span></h2><table><tr><th>Date</th><th>Type</th><th>Detail</th><th>Amount</th></tr>${body}</table>`;
  }).join("");
}

/** Commission rates include GST, so the statement shows the GST share of the period's net commission */
function commissionNote(lines: Line[]) {
  const net = -lines.filter((l) => l.type === "COMMISSION" || l.type === "COMMISSION_REFUND").reduce((n, l) => n + Number(l.amount), 0);
  if (net <= 0) return "";
  const gst = (net * COMMISSION_GST_PCT) / (100 + COMMISSION_GST_PCT);
  return `<p class="muted">Martly commission this period ${inr(net)}, including GST of ${inr(gst)} at ${COMMISSION_GST_PCT}%.</p>`;
}

/** A printable settlement statement; statement totals always equal the sum of its lines plus what was carried in */
export async function renderStatement(prisma: PrismaClient, settlementId: string) {
  const s = await prisma.settlement.findUnique({
    where: { id: settlementId },
    include: { organization: { select: { name: true } }, entries: { where: { type: { not: "SETTLEMENT_PAYOUT" } }, orderBy: { createdAt: "asc" } } },
  });
  if (!s) return null;
  const stores = await prisma.store.findMany({ where: { organizationId: s.organizationId }, select: { id: true, name: true } });
  const paid = s.status === "PAID" ? `<p>Paid ${s.paidAt ? day(s.paidAt) : ""} by ${s.payoutMethod === "UPI" ? "UPI" : "bank transfer"} · UTR ${esc(s.utr)}</p>` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Statement ${esc(s.number)}</title>
<style>body{font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;max-width:860px;margin:24px auto;padding:0 16px}
h1{font-size:22px;margin:0}h2{font-size:16px;margin:24px 0 0}table{width:100%;border-collapse:collapse;margin-top:8px}
td,th{padding:6px 8px;border-bottom:1px solid #e2e8f0;text-align:left;vertical-align:top}td:last-child,th:last-child{text-align:right;white-space:nowrap}
.muted{color:#64748b;font-weight:400}.total td{font-weight:700;font-size:16px}@media print{button{display:none}}</style></head><body>
<h1>Settlement statement</h1><div class="muted">${esc(s.number)} · ${esc(s.organization.name)} · ${day(s.periodStart)} – ${day(s.periodEnd)} · ${esc(SettlementStatusLabels[s.status])}</div>
<table><tr><td>Credits</td><td>${inr(s.credits)}</td></tr><tr><td>Debits</td><td>${inr(s.debits)}</td></tr>
<tr><td>Carried in from earlier weeks</td><td>${inr(s.carriedIn)}</td></tr><tr class="total"><td>Net</td><td>${inr(s.net)}</td></tr></table>${paid}${commissionNote(s.entries as Line[])}
${storeSections(s.entries as Line[], new Map(stores.map((st) => [st.id, st.name])))}
<p class="muted">Positive amounts are owed by Martly to the store; negative amounts are owed to Martly. Cash on delivery stays with the store; only Martly's commission on it is part of this statement.</p>
<button onclick="print()">Print or save as PDF</button></body></html>`;
}
