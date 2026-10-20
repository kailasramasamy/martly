import { useState } from "react";
import { Form, Input, Modal, Select } from "antd";

interface PaidValues { method: "BANK_TRANSFER" | "UPI"; utr: string }

export function MarkPaidModal({ count, onCancel, onSubmit }: { count: number; onCancel: () => void; onSubmit: (v: PaidValues) => Promise<void> }) {
  const [form] = Form.useForm<PaidValues>();
  const [saving, setSaving] = useState(false);
  const ok = async () => {
    const values = await form.validateFields();
    setSaving(true);
    await onSubmit(values).finally(() => setSaving(false));
  };
  return (
    <Modal open title={`Mark ${count} payout${count === 1 ? "" : "s"} paid`} okText="Mark paid" onCancel={onCancel} onOk={ok} confirmLoading={saving}>
      <Form form={form} layout="vertical" initialValues={{ method: "BANK_TRANSFER" }}>
        <Form.Item name="method" label="Method" rules={[{ required: true }]}>
          <Select options={[{ value: "BANK_TRANSFER", label: "Bank transfer" }, { value: "UPI", label: "UPI" }]} />
        </Form.Item>
        <Form.Item name="utr" label="UTR / reference" extra="Applied to every selected payout." rules={[{ required: true, min: 6, max: 40, message: "Enter the UTR (6 to 40 characters)" }]}>
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
}

export function MarkFailedModal({ number, onCancel, onSubmit }: { number: string; onCancel: () => void; onSubmit: (reason: string) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const ok = async () => {
    setSaving(true);
    await onSubmit(reason.trim()).finally(() => setSaving(false));
  };
  return (
    <Modal open title={`Mark ${number} failed`} okText="Mark failed" okButtonProps={{ danger: true, disabled: reason.trim().length < 3 }} onCancel={onCancel} onOk={ok} confirmLoading={saving}>
      <Input.TextArea rows={3} placeholder="Why did the transfer fail?" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  );
}
