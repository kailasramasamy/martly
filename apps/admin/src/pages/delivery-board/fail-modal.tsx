import { useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import { DELIVERY_FAILURE_LABELS, type DeliveryFailureReason } from "@martly/shared/constants";
import type { Stop } from "./types";

interface FailModalProps {
  stop: Stop | null;
  onSubmit: (orderId: string, reason: DeliveryFailureReason, note: string) => Promise<boolean>;
  onClose: () => void;
}

const REASON_OPTIONS = Object.entries(DELIVERY_FAILURE_LABELS).map(([value, label]) => ({ value, label }));

export function FailModal({ stop, onSubmit, onClose }: FailModalProps) {
  const [form] = Form.useForm<{ reason: DeliveryFailureReason; note?: string }>();
  const [saving, setSaving] = useState(false);
  const reason = Form.useWatch("reason", form);

  const submit = async () => {
    if (!stop) return;
    const values = await form.validateFields();
    setSaving(true);
    const ok = await onSubmit(stop.id, values.reason, values.note?.trim() ?? "");
    setSaving(false);
    if (ok) onClose();
  };

  return (
    <Modal
      title={stop ? `Couldn't deliver #${stop.id.slice(0, 8)}` : ""}
      open={!!stop}
      onCancel={onClose}
      onOk={submit}
      okText="Mark as failed"
      okButtonProps={{ danger: true, loading: saving }}
      afterClose={() => form.resetFields()}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="reason" label="Reason" rules={[{ required: true, message: "Pick a reason" }]}>
          <Select placeholder="Why couldn't it be delivered?" options={REASON_OPTIONS} />
        </Form.Item>
        <Form.Item
          name="note"
          label="Note"
          rules={[{ required: reason === "OTHER", whitespace: true, message: "Add a note for Other" }]}
        >
          <Input.TextArea rows={3} maxLength={300} placeholder="Anything the team should know" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
