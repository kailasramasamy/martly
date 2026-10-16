import { SectionCard } from "../ui/SectionCard";
import { KeyValue } from "../ui/KeyValue";
import { StatusPill } from "../ui/StatusPill";
import { formatDate } from "../ui/dates";
import { COUNT_STATUS, type StockCountDetail } from "./types";

/** Header facts for a count: where, who, when and the review outcome */
export function CountSummary({ count }: { count: StockCountDetail }) {
  const mismatches = count.items.filter((i) => i.difference).length;
  return (
    <SectionCard title="Count" style={{ margin: 14 }}>
      <StatusPill {...COUNT_STATUS[count.status]} />
      <KeyValue label="Store" value={count.store.name} />
      <KeyValue label="Aisle" value={count.subcategory.name} />
      <KeyValue label="Counted by" value={count.createdBy.name} />
      <KeyValue label="Items counted" value={`${count.countedItems} of ${count.items.length}`} />
      {count.canSeeSystemStock && count.status !== "DRAFT" && <KeyValue label="Differences" value={mismatches} />}
      {count.submittedAt && <KeyValue label="Submitted" value={formatDate(count.submittedAt, true)} />}
      {count.note ? <KeyValue label="Note" value={count.note} /> : null}
      {count.reviewedBy && <KeyValue label="Reviewed by" value={count.reviewedBy.name} />}
      {count.reviewedAt && <KeyValue label="Reviewed" value={formatDate(count.reviewedAt, true)} />}
      {count.reviewNote && count.status !== "RECOUNT" ? <KeyValue label="Review note" value={count.reviewNote} /> : null}
    </SectionCard>
  );
}
