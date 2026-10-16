import { useState } from "react";
import { Alert, Button, Flex, Input, Modal, Tag, Typography } from "antd";
import type { ReactNode } from "react";
import { CloseCircleOutlined, UndoOutlined } from "@ant-design/icons";

const OTHER = "Other";

export interface ReasonPreset {
  button: string;
  icon: ReactNode;
  title: string;
  warning: string;
  question: string;
  reasons: string[];
  confirmLabel: string;
  keepLabel: string;
}

export const CANCEL_ORDER: ReasonPreset = {
  button: "Cancel Order",
  icon: <CloseCircleOutlined />,
  title: "Cancel this order?",
  warning: "The customer is notified, any payment is refunded and reserved stock is released. This can't be undone.",
  question: "Why are you cancelling?",
  reasons: ["Out of stock", "Customer asked to cancel", "Can't deliver to address", "Payment issue", "Store closed"],
  confirmLabel: "Cancel order",
  keepLabel: "Keep order",
};

export const UNDO_DELIVERY: ReasonPreset = {
  button: "Undo Delivery",
  icon: <UndoOutlined />,
  title: "Undo delivery?",
  warning: "The order goes back a step, sold stock is put back, cash-on-delivery returns to unpaid and loyalty points are taken back. The customer is told the status was corrected.",
  question: "What happened?",
  reasons: ["Marked by mistake", "Customer didn't receive it", "Wrong order marked"],
  confirmLabel: "Undo delivery",
  keepLabel: "Keep delivered",
};

interface ReasonConfirmButtonProps {
  preset: ReasonPreset;
  loading?: boolean;
  size?: "small" | "middle";
  /** Icon-only button for dense tables */
  compact?: boolean;
  onConfirm: (reason: string) => Promise<void>;
}

/** A serious order change that needs a reason (one click for common ones); the reason is saved on the order's history */
export function ReasonConfirmButton({ preset, loading, size = "middle", compact, onConfirm }: ReasonConfirmButtonProps) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const reason = picked === OTHER ? other.trim() : picked;

  const close = () => {
    setOpen(false);
    setPicked(null);
    setOther("");
  };

  const confirm = async () => {
    if (!reason) return;
    setSaving(true);
    await onConfirm(reason);
    setSaving(false);
    close();
  };

  return (
    <>
      <Button danger size={size} icon={preset.icon} loading={loading} onClick={() => setOpen(true)}>
        {compact ? null : preset.button}
      </Button>
      <Modal
        open={open}
        title={preset.title}
        okText={preset.confirmLabel}
        cancelText={preset.keepLabel}
        okButtonProps={{ danger: true, type: "primary", disabled: !reason }}
        confirmLoading={saving}
        onOk={confirm}
        onCancel={close}
      >
        <Flex vertical gap={14}>
          <Alert type="error" showIcon message={preset.warning} />
          <Typography.Text strong>{preset.question}</Typography.Text>
          <Flex wrap gap={8}>
            {[...preset.reasons, OTHER].map((r) => (
              <Tag.CheckableTag key={r} checked={picked === r} onChange={() => setPicked(r)} style={{ padding: "4px 12px", fontSize: 13 }}>
                {r}
              </Tag.CheckableTag>
            ))}
          </Flex>
          {picked === OTHER && (
            <Input.TextArea value={other} onChange={(e) => setOther(e.target.value)} placeholder="Add a short note" maxLength={500} rows={3} autoFocus />
          )}
        </Flex>
      </Modal>
    </>
  );
}
