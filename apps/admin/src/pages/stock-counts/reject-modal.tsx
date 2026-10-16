import { useState } from "react";
import { Modal, Input } from "antd";

interface RejectModalProps {
  open: boolean;
  busy: boolean;
  onClose: () => void;
  /** Resolves true once the count is rejected */
  onReject: (note: string | undefined) => Promise<boolean>;
}

export function RejectModal({ open, busy, onClose, onReject }: RejectModalProps) {
  const [note, setNote] = useState("");
  const reject = async () => {
    if (await onReject(note.trim() || undefined)) {
      setNote("");
      onClose();
    }
  };
  return (
    <Modal title="Reject count" open={open} onCancel={onClose} onOk={reject} okText="Reject" okButtonProps={{ danger: true }} confirmLoading={busy}>
      <Input.TextArea rows={3} maxLength={300} placeholder="Reason (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
    </Modal>
  );
}
