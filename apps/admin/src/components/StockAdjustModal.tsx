import { useState } from "react";
import { Modal, Form, Radio, InputNumber, Input, Typography, message } from "antd";

import { axiosInstance } from "../providers/data-provider";

interface Props {
  storeProductId: string | null;
  productLabel?: string;
  currentStock?: number;
  onClose: () => void;
  onDone: () => void;
}

interface FormValues {
  type: "DAMAGE" | "EXPIRY" | "MANUAL";
  direction: "remove" | "add";
  amount: number;
  note: string;
}

const TYPE_OPTIONS = [
  { label: "Damaged", value: "DAMAGE" },
  { label: "Expired", value: "EXPIRY" },
  { label: "Correction", value: "MANUAL" },
];

export const StockAdjustModal = ({ storeProductId, productLabel, currentStock, onClose, onDone }: Props) => {
  const [form] = Form.useForm<FormValues>();
  const [saving, setSaving] = useState(false);
  const type = Form.useWatch("type", form);

  const submit = async () => {
    const v = await form.validateFields();
    const signed = v.type === "MANUAL" && v.direction === "add" ? v.amount : -v.amount;
    setSaving(true);
    try {
      await axiosInstance.post("/stock/adjust", {
        storeProductId,
        quantity: signed,
        type: v.type,
        note: v.note.trim(),
      });
      message.success("Stock adjusted");
      form.resetFields();
      onDone();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to adjust stock");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Adjust stock"
      open={!!storeProductId}
      onCancel={onClose}
      onOk={submit}
      okText="Apply"
      confirmLoading={saving}
      destroyOnClose
    >
      {productLabel && (
        <Typography.Paragraph>
          <strong>{productLabel}</strong>
          {currentStock !== undefined && <> — current stock {currentStock}</>}
        </Typography.Paragraph>
      )}
      <Form form={form} layout="vertical" initialValues={{ type: "DAMAGE", direction: "remove" }}>
        <Form.Item name="type" label="Reason">
          <Radio.Group options={TYPE_OPTIONS} optionType="button" />
        </Form.Item>
        {type === "MANUAL" && (
          <Form.Item name="direction" label="Correction">
            <Radio.Group
              optionType="button"
              options={[
                { label: "Remove", value: "remove" },
                { label: "Add", value: "add" },
              ]}
            />
          </Form.Item>
        )}
        <Form.Item name="amount" label="Quantity" rules={[{ required: true, message: "Enter a quantity" }]}>
          <InputNumber min={1} precision={0} style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="note" label="Note" rules={[{ required: true, whitespace: true, message: "A note is required" }]}>
          <Input.TextArea rows={2} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
