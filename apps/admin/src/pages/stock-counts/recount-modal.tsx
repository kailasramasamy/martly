import { useEffect, useState } from "react";
import { Modal, Input, Checkbox, message } from "antd";

import { axiosInstance } from "../../providers/data-provider";
import type { CountDetail } from "./count-items-table";

interface Props {
  countId: string;
  open: boolean;
  selectedIds: string[];
  restCount: number;
  onClose: () => void;
  onDone: (detail: CountDetail) => void;
}

export const RecountModal = ({ countId, open, selectedIds, restCount, onClose, onDone }: Props) => {
  const [note, setNote] = useState("");
  const [approveRest, setApproveRest] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setNote("");
      setApproveRest(true);
    }
  }, [open]);

  const submit = async () => {
    setSaving(true);
    try {
      const res = await axiosInstance.post(`/stock/counts/${countId}/recount`, {
        storeProductIds: selectedIds,
        note: note.trim() || undefined,
        approveRest,
      });
      message.success("Recount requested");
      onDone(res.data.data);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to request recount");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={`Request recount · ${selectedIds.length} items`}
      open={open}
      onCancel={onClose}
      onOk={submit}
      okText="Request recount"
      confirmLoading={saving}
    >
      <Input.TextArea rows={3} maxLength={300} placeholder="Note for the counter (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      <Checkbox style={{ marginTop: 12 }} checked={approveRest} onChange={(e) => setApproveRest(e.target.checked)}>
        Approve the other {restCount} lines now
      </Checkbox>
    </Modal>
  );
};
