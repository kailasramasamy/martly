import { Table, Tag } from "antd";
import {
  RefuseReasonLabels,
  ReturnMethodLabels,
  ReturnRemedyLabels,
  type RefuseReason,
  type ReturnMethod,
  type ReturnRemedy,
} from "@martly/shared/constants";

export interface FlaggedItem {
  refusedQuantity?: number;
  refusedReason?: string | null;
  replacesReturnId?: string | null;
}

export const ItemFlags = ({ item }: { item: FlaggedItem }) => (
  <>
    {Number(item.refusedQuantity) > 0 && (
      <Tag color="orange" style={{ marginLeft: 8 }}>
        {item.refusedQuantity} handed back
        {item.refusedReason ? ` · ${RefuseReasonLabels[item.refusedReason as RefuseReason]}` : ""}
      </Tag>
    )}
    {item.replacesReturnId && <Tag color="blue" style={{ marginLeft: 8 }}>Free replacement</Tag>}
  </>
);

export const ReturnOutcome = ({ request }: { request: { remedy?: ReturnRemedy; method?: ReturnMethod } }) =>
  request.remedy && request.method ? (
    <span style={{ color: "#64748b" }}>
      {ReturnRemedyLabels[request.remedy]} {"·"} {ReturnMethodLabels[request.method]}
    </span>
  ) : null;

export const RefusedSummaryRow = ({ amount }: { amount: number }) =>
  amount > 0 ? (
    <Table.Summary.Row>
      <Table.Summary.Cell index={0} colSpan={3} />
      <Table.Summary.Cell index={1}>Handed back at door</Table.Summary.Cell>
      <Table.Summary.Cell index={2}>{"\u2212"}{"\u20B9"}{amount.toFixed(0)}</Table.Summary.Cell>
    </Table.Summary.Row>
  ) : null;
