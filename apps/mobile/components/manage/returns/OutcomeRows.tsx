import { ReturnMethodLabels, ReturnRemedyLabels } from "@martly/shared/constants";
import { KeyValue } from "../ui/KeyValue";
import { formatDate } from "../ui/dates";
import { orderRef } from "../rider/format";
import type { ReturnRequestDetail } from "./types";

function receivedText(r: ReturnRequestDetail): string {
  const how = r.collectedOnOrderId ? `Rider collected it with ${orderRef(r.collectedOnOrderId)}` : "Dropped at store";
  return `${formatDate(r.receivedAt as string, true)} · ${how}`;
}

/** The rider or staff member who took the item back, with their phone so staff can follow up */
function receiverText(r: ReturnRequestDetail): string | null {
  if (!r.receiver) return null;
  const who = r.receiver.name || (r.receiver.role === "RIDER" ? "Rider" : "Staff");
  return r.receiver.phone ? `${who} · ${r.receiver.phone}` : who;
}

export function OutcomeRows({ request: r }: { request: ReturnRequestDetail }) {
  if (!r.remedy || !r.method) return null;
  const replacement = r.replacementItems[0];
  return (
    <>
      <KeyValue label="Outcome" value={ReturnRemedyLabels[r.remedy]} />
      <KeyValue label="Return method" value={ReturnMethodLabels[r.method]} />
      {r.receivedAt ? <KeyValue label="Received" value={receivedText(r)} /> : null}
      {receiverText(r) ? <KeyValue label={r.collectedOnOrderId ? "Collected by" : "Received by"} value={receiverText(r) as string} /> : null}
      {r.refundedAt ? <KeyValue label="Refunded" value={formatDate(r.refundedAt, true)} /> : null}
      {r.remedy === "REPLACE" && replacement ? <KeyValue label="Replacement" value={`Sent on order ${orderRef(replacement.orderId)}`} /> : null}
    </>
  );
}
