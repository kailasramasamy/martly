import { useState } from "react";
import { Form, Input, Modal, Select } from "antd";
import { INDIAN_STATES } from "@martly/shared/constants";
import type { BillingProfile, BillingValues } from "./types";

const stateOptions = INDIAN_STATES.map((s) => ({ value: s, label: s }));

/** GST invoice details; the state decides CGST + SGST versus IGST */
export function BillingFields() {
  return (
    <>
      <Form.Item name="billingName" label="Legal name" rules={[{ required: true, whitespace: true }]}>
        <Input maxLength={120} />
      </Form.Item>
      <Form.Item name="gstin" label="GSTIN (optional)">
        <Input maxLength={15} style={{ textTransform: "uppercase" }} />
      </Form.Item>
      <Form.Item name="billingAddress" label="Address" rules={[{ required: true, whitespace: true }]}>
        <Input.TextArea rows={3} maxLength={300} />
      </Form.Item>
      <Form.Item name="billingState" label="State" rules={[{ required: true }]}>
        <Select showSearch optionFilterProp="label" options={stateOptions} />
      </Form.Item>
    </>
  );
}

export const billingInitialValues = (profile: BillingProfile | null) => ({
  billingName: profile?.billingName ?? undefined,
  gstin: profile?.gstin ?? undefined,
  billingAddress: profile?.billingAddress ?? undefined,
  billingState: profile?.billingState ?? undefined,
});

export const hasBilling = (profile: BillingProfile | null): boolean =>
  !!(profile?.billingName && profile.billingAddress && profile.billingState);

interface BillingModalProps<T extends BillingValues> {
  open: boolean;
  title: string;
  okText: string;
  profile: BillingProfile | null;
  /** Extra fields shown above the billing details, e.g. a bank reference */
  extra?: React.ReactNode;
  onSubmit: (values: T) => Promise<void>;
  onClose: () => void;
}

export function BillingModal<T extends BillingValues>({ open, title, okText, profile, extra, onSubmit, onClose }: BillingModalProps<T>) {
  const [form] = Form.useForm<T>();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await onSubmit(values);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title={title} okText={okText} onOk={submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false} initialValues={billingInitialValues(profile)}>
        {extra}
        <BillingFields />
      </Form>
    </Modal>
  );
}
