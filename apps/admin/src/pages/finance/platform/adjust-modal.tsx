import { useEffect, useState } from "react";
import { App, Form, Input, InputNumber, Modal, Select } from "antd";
import { ledgerAdjustmentSchema } from "@martly/shared/schemas";
import { axiosInstance } from "../../../providers/data-provider";
import { errorMessage } from "../utils";

export interface Option { value: string; label: string }
interface Values { organizationId: string; storeId?: string; amount: number; reason: string }

export const loadOptions = (url: string, params: object): Promise<Option[]> =>
  axiosInstance.get(url, { params: { pageSize: 100, ...params } })
    .then((res) => res.data.data.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name })));

interface Props { open: boolean; orgs: Option[]; onClose: () => void; onRecorded: () => void }

export function AdjustModal({ open, orgs, onClose, onRecorded }: Props) {
  const { notification } = App.useApp();
  const [form] = Form.useForm<Values>();
  const [stores, setStores] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);
  const organizationId = Form.useWatch("organizationId", form);

  useEffect(() => {
    form.setFieldValue("storeId", undefined);
    setStores([]);
    if (organizationId) void loadOptions("/stores", { organizationId }).then(setStores);
  }, [organizationId, form]);

  const submit = async (values: Values) => {
    const parsed = ledgerAdjustmentSchema.safeParse(values);
    if (!parsed.success) { notification.error({ message: parsed.error.issues[0].message }); return; }
    setSaving(true);
    try {
      await axiosInstance.post("/ledger/platform/adjustments", parsed.data);
      notification.success({ message: "Adjustment recorded" });
      onRecorded();
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not record the adjustment") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="Record adjustment" okText="Record adjustment" onOk={form.submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" onFinish={submit} preserve={false}>
        <Form.Item name="organizationId" label="Organization" rules={[{ required: true, message: "Choose an organization" }]}>
          <Select showSearch optionFilterProp="label" options={orgs} />
        </Form.Item>
        <Form.Item name="storeId" label="Store (optional)"><Select allowClear showSearch optionFilterProp="label" options={stores} disabled={!organizationId} /></Form.Item>
        <Form.Item name="amount" label="Amount (₹)" extra="Positive pays the store, negative charges it." rules={[{ required: true, message: "Enter a non-zero amount" }]}>
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item name="reason" label="Reason" extra="The owner sees this in their ledger." rules={[{ required: true, min: 5, message: "Give a reason of at least 5 characters" }]}>
          <Input.TextArea rows={3} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
