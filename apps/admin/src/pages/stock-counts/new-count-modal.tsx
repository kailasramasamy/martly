import { useEffect, useState } from "react";
import { Modal, Form, Input, Cascader, message } from "antd";
import { useNavigate } from "react-router";

import { axiosInstance } from "../../providers/data-provider";
import { StoreSelect } from "../../components/StoreSelect";
import { buildCascaderOptions } from "../products/product-form-options";
import type { CascaderOption } from "../products/product-form-options";

interface Props {
  open: boolean;
  onClose: () => void;
}

export const NewCountModal = ({ open, onClose }: Props) => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [options, setOptions] = useState<CascaderOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axiosInstance
      .get("/categories/tree")
      .then((res) => setOptions(buildCascaderOptions(res.data.data)))
      .catch(() => setOptions([]));
  }, []);

  const submit = async () => {
    const v = await form.validateFields();
    setSaving(true);
    try {
      const res = await axiosInstance.post("/stock/counts", {
        storeId: v.storeId,
        subcategoryId: v.aisle[v.aisle.length - 1],
        note: v.note?.trim() || undefined,
      });
      form.resetFields();
      navigate(`/stock-counts/${res.data.data.id}`);
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to start count");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="New stock count" open={open} onCancel={onClose} onOk={submit} okText="Start count" confirmLoading={saving} destroyOnClose>
      <Form form={form} layout="vertical">
        <Form.Item name="storeId" label="Store" rules={[{ required: true, message: "Select a store" }]}>
          <StoreSelect />
        </Form.Item>
        <Form.Item
          name="aisle"
          label="Aisle (subcategory)"
          rules={[
            {
              validator: (_, val?: string[]) =>
                val?.length === 3 ? Promise.resolve() : Promise.reject(new Error("Pick a subcategory")),
            },
          ]}
        >
          <Cascader options={options} showSearch placeholder="Department / Category / Subcategory" />
        </Form.Item>
        <Form.Item name="note" label="Note">
          <Input.TextArea rows={2} maxLength={300} />
        </Form.Item>
      </Form>
    </Modal>
  );
};
