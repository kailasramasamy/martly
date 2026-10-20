import { useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { Alert, Form, Input, InputNumber, Modal, Radio, Select, Space, Typography, message } from "antd";
import type { FormInstance } from "antd";
import { MinusOutlined, PlusOutlined, WalletOutlined } from "@ant-design/icons";
import { isAxiosError } from "axios";
import { axiosInstance } from "../../providers/data-provider";

interface OrderOption { id: string; createdAt: string; totalAmount: number | string; store?: { name: string } }

interface Props {
  userId: string;
  balance: number | null;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

const FUNDED_BY_HELP = "Store-funded credits come off the store's balance in its ledger. Martly goodwill is paid by Martly.";

function useCustomerOrders(userId: string, open: boolean) {
  const [orders, setOrders] = useState<OrderOption[]>([]);
  useEffect(() => {
    if (!open) return;
    axiosInstance.get("/orders", { params: { userId, pageSize: 50 } }).then((res) => setOrders(res.data.data));
  }, [open, userId]);
  return orders;
}

function AdjustFields({ form, orders, isSuperAdmin }: { form: FormInstance; orders: OrderOption[]; isSuperAdmin: boolean }) {
  const type = Form.useWatch("type", form);
  const fundedBy = Form.useWatch("fundedBy", form);
  return (
    <Form form={form} layout="vertical" initialValues={{ type: "CREDIT", fundedBy: "PLATFORM" }}>
      <Form.Item name="type" label="Type" rules={[{ required: true }]}>
        <Radio.Group>
          <Radio.Button value="CREDIT"><PlusOutlined /> Credit</Radio.Button>
          <Radio.Button value="DEBIT"><MinusOutlined /> Debit</Radio.Button>
        </Radio.Group>
      </Form.Item>
      <Form.Item name="amount" label="Amount (₹)" rules={[{ required: true, message: "Enter amount" }]}>
        <InputNumber min={1} max={100000} style={{ width: "100%" }} placeholder="Enter amount" />
      </Form.Item>
      <Form.Item
        name="orderId"
        label="Order (optional)"
        rules={[{ required: isSuperAdmin && type === "CREDIT" && fundedBy === "ORG", message: "Pick the order the store is charged for" }]}
      >
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder="Link to one of the customer's orders"
          options={orders.map((o) => ({
            value: o.id,
            label: `#${o.id.slice(0, 8).toUpperCase()} \u00B7 \u20B9${Number(o.totalAmount).toLocaleString("en-IN")}${o.store ? ` \u00B7 ${o.store.name}` : ""}`,
          }))}
        />
      </Form.Item>
      {isSuperAdmin && type === "CREDIT" && (
        <Form.Item name="fundedBy" label="Funded by" extra={<Typography.Text type="secondary">{FUNDED_BY_HELP}</Typography.Text>}>
          <Radio.Group>
            <Radio value="PLATFORM">Martly goodwill</Radio>
            <Radio value="ORG">Charge the store</Radio>
          </Radio.Group>
        </Form.Item>
      )}
      <Form.Item name="description" label="Reason / Note">
        <Input.TextArea rows={2} placeholder="e.g. Compensation for delayed delivery" />
      </Form.Item>
    </Form>
  );
}

export function WalletAdjustModal({ userId, balance, open, onClose, onDone }: Props) {
  const { data: identity } = useGetIdentity<{ role: string }>();
  const isSuperAdmin = identity?.role === "SUPER_ADMIN";
  const [form] = Form.useForm();
  const orders = useCustomerOrders(userId, open);
  const [saving, setSaving] = useState(false);

  const close = () => { form.resetFields(); onClose(); };

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await axiosInstance.post(`/wallet/admin/${userId}/adjust`, {
        type: values.type,
        amount: values.amount,
        description: values.description,
        orderId: values.orderId,
        fundedBy: isSuperAdmin && values.type === "CREDIT" ? values.fundedBy : undefined,
      });
      message.success(`Wallet ${values.type === "CREDIT" ? "credited" : "debited"} successfully`);
      close();
      onDone();
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message || "Failed to adjust wallet");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={<Space><WalletOutlined /> Adjust Wallet Balance</Space>} open={open} onCancel={close} onOk={submit} confirmLoading={saving} okText="Submit">
      <Alert type="info" showIcon style={{ marginBottom: 16 }} message={`Current balance: \u20B9${balance?.toFixed(0) ?? 0}`} />
      <AdjustFields form={form} orders={orders} isSuperAdmin={isSuperAdmin} />
    </Modal>
  );
}
