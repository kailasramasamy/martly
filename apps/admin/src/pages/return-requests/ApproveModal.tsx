import { useState } from "react";
import { Modal, InputNumber, Input, Radio, Checkbox } from "antd";
import {
  ReturnMethod,
  ReturnMethodLabels,
  ReturnRemedy,
  ReturnRemedyLabels,
  RETURN_KEEP_REASONS,
} from "@martly/shared/constants";

const { TextArea } = Input;

const WRONG_ITEM_REASON = "Wrong item received";
const rupees = (v: number | string) => `₹${Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;

export interface ApproveBody {
  remedy: ReturnRemedy;
  method: ReturnMethod;
  approvedAmount?: number;
  adminNote?: string;
  restockItemIds?: string[];
}

interface Props {
  record: any;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (body: ApproveBody) => void;
}

const labelStyle = { display: "block", marginBottom: 4, fontWeight: 500 } as const;
const mutedStyle = { fontSize: 12, color: "#64748b", marginTop: 4 } as const;

const keepHint = (record: any): string | null => {
  const threshold = record.store?.returnKeepThreshold;
  if (threshold != null && Number(record.requestedAmount) <= Number(threshold)) {
    return `Under the store's ${rupees(threshold)} keep-it limit`;
  }
  if (RETURN_KEEP_REASONS.includes(record.reason)) return "This reason usually doesn't need the item back";
  return null;
};

const nextStep = (remedy: ReturnRemedy, method: ReturnMethod): string => {
  if (remedy === ReturnRemedy.REFUND && method === ReturnMethod.KEEP) return "The refund is paid to the customer's wallet right away.";
  const arrived = method === ReturnMethod.NEXT_ORDER ? "collected by the rider" : "back with the store";
  return remedy === ReturnRemedy.REFUND
    ? `The refund is paid when the item is ${arrived}.`
    : `A free replacement goes out with the customer's next order, and the item is ${arrived}.`;
};

export const ApproveModal = ({ record, loading, onCancel, onSubmit }: Props) => {
  const hint = keepHint(record);
  const [remedy, setRemedy] = useState<ReturnRemedy>(ReturnRemedy.REFUND);
  const [method, setMethod] = useState<ReturnMethod>(hint ? ReturnMethod.KEEP : ReturnMethod.NEXT_ORDER);
  const [amount, setAmount] = useState<number>(Number(record.requestedAmount));
  const [note, setNote] = useState("");
  const [restock, setRestock] = useState<string[]>(
    record.reason === WRONG_ITEM_REASON ? (record.items ?? []).map((i: { id: string }) => i.id) : [],
  );

  const refundNow = remedy === ReturnRemedy.REFUND && method === ReturnMethod.KEEP;

  const submit = () => {
    const body: ApproveBody = { remedy, method };
    if (remedy === ReturnRemedy.REFUND) body.approvedAmount = amount;
    if (note.trim()) body.adminNote = note.trim();
    if (method !== ReturnMethod.KEEP) body.restockItemIds = restock;
    onSubmit(body);
  };

  return (
    <Modal
      title="Approve Return Request"
      open
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={loading}
      okText={refundNow ? "Approve & refund" : "Approve"}
      okButtonProps={{ style: { backgroundColor: "#16a34a", borderColor: "#16a34a" } }}
    >
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>What does the customer get?</label>
        <Radio.Group
          optionType="button"
          value={remedy}
          onChange={(e) => setRemedy(e.target.value)}
          options={Object.values(ReturnRemedy).map((v) => ({ value: v, label: ReturnRemedyLabels[v] }))}
        />
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle}>How does the item come back?</label>
        <Radio.Group
          optionType="button"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          options={Object.values(ReturnMethod).map((v) => ({ value: v, label: ReturnMethodLabels[v] }))}
        />
        {hint && method === ReturnMethod.KEEP && <div style={mutedStyle}>{hint}</div>}
      </div>
      {remedy === ReturnRemedy.REFUND && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Refund Amount ({"₹"})</label>
          <InputNumber
            value={amount}
            onChange={(v) => setAmount(v ?? 0)}
            min={0}
            max={Number(record.requestedAmount)}
            style={{ width: "100%" }}
            prefix={"₹"}
          />
          <div style={mutedStyle}>Requested: {rupees(record.requestedAmount)}. Adjust for partial refunds.</div>
        </div>
      )}
      {method !== ReturnMethod.KEEP && (
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Put back in stock when received</label>
          <Checkbox.Group
            value={restock}
            onChange={(v) => setRestock(v as string[])}
            style={{ display: "flex", flexDirection: "column", gap: 4 }}
            options={(record.items ?? []).map((i: any) => ({
              value: i.id,
              label: `${i.orderItem?.product?.name ?? "Item"} × ${i.quantity}`,
            }))}
          />
        </div>
      )}
      <div>
        <label style={labelStyle}>Admin Note (optional)</label>
        <TextArea rows={3} placeholder="Reason for approval or partial refund..." value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <div style={{ ...mutedStyle, marginTop: 12 }}>{nextStep(remedy, method)}</div>
    </Modal>
  );
};
