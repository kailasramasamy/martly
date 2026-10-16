import { useEffect, useState } from "react";
import { Modal, InputNumber, Input, message } from "antd";

import { axiosInstance } from "../../providers/data-provider";
import type { CountDetail, CountItem } from "./count-items-table";

interface Props {
  countId: string;
  item: CountItem | null;
  onClose: () => void;
  onDone: (detail: CountDetail) => void;
}

export const CorrectLineModal = ({ countId, item, onClose, onDone }: Props) => {
  const [qty, setQty] = useState<number | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setQty(item?.countedQty ?? null);
    setReason("");
  }, [item]);

  const submit = async () => {
    if (!item) return;
    setSaving(true);
    try {
      const res = await axiosInstance.put(`/stock/counts/${countId}/lines/${item.storeProductId}/correct`, {
        countedQty: qty,
        reason: reason.trim(),
      });
      message.success("Count corrected");
      onDone(res.data.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to correct count");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={item ? `Correct count — ${item.productName}` : "Correct count"}
      open={!!item}
      onCancel={onClose}
      onOk={submit}
      okText="Save correction"
      okButtonProps={{ disabled: qty === null || reason.trim().length < 3 }}
      confirmLoading={saving}
    >
      <InputNumber min={0} precision={0} value={qty} onChange={setQty} style={{ width: "100%", marginBottom: 12 }} />
      <Input.TextArea rows={3} minLength={3} maxLength={300} placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
};
