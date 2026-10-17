import { useEffect, useState } from "react";
import { App, Button, Card, Descriptions, Form, Space, Table, Tag, Typography } from "antd";
import { EditOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import { BillingFields, billingInitialValues, hasBilling } from "./billing-form";
import type { BillingProfile, BillingValues } from "./types";
import { errorMessage, invoiceHref } from "./utils";

interface Invoice {
  id: string;
  number: string | null;
  product: { name: string; kind: string };
  quantity: number;
  total: number;
  status: string;
  paidAt: string | null;
  invoiceUrl: string | null;
}

interface BillingTabProps {
  profile: BillingProfile | null;
  canEdit: boolean;
  onSaved: (p: BillingProfile) => void;
}

function BillingView({ profile }: { profile: BillingProfile | null }) {
  if (!hasBilling(profile)) return <Typography.Text type="secondary">No billing details yet. They're needed before buying a plan.</Typography.Text>;
  return (
    <Descriptions column={1} size="small" styles={{ label: { width: 110 } }}>
      <Descriptions.Item label="Legal name">{profile!.billingName}</Descriptions.Item>
      <Descriptions.Item label="GSTIN">{profile!.gstin || "—"}</Descriptions.Item>
      <Descriptions.Item label="Address">{profile!.billingAddress}</Descriptions.Item>
      <Descriptions.Item label="State">{profile!.billingState}</Descriptions.Item>
    </Descriptions>
  );
}

function BillingCard({ profile, canEdit, onSaved }: BillingTabProps) {
  const { notification } = App.useApp();
  const [form] = Form.useForm<BillingValues>();
  const [saving, setSaving] = useState(false);
  // Owners without details go straight to the form; otherwise the details show read-only until Edit
  const [editing, setEditing] = useState(canEdit && !hasBilling(profile));

  useEffect(() => { form.setFieldsValue(billingInitialValues(profile)); }, [form, profile, editing]);

  const save = async (values: BillingValues) => {
    setSaving(true);
    try {
      await axiosInstance.put("/marketing/billing-profile", values);
      onSaved({ ...values, gstin: values.gstin ?? null });
      setEditing(false);
      notification.success({ message: "Billing details saved" });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save billing details") });
    } finally {
      setSaving(false);
    }
  };

  const editButton = canEdit && !editing ? <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(true)}>Edit</Button> : null;
  return (
    <Card title="Billing details" size="small" extra={editButton} style={{ marginBottom: 16, maxWidth: 560 }}>
      {editing ? (
        <Form form={form} layout="vertical" onFinish={save}>
          <BillingFields />
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>Save</Button>
            {hasBilling(profile) && <Button onClick={() => setEditing(false)}>Cancel</Button>}
          </Space>
        </Form>
      ) : (
        <BillingView profile={profile} />
      )}
    </Card>
  );
}

function InvoicesCard() {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axiosInstance.get("/marketing/orders")
      .then((res) => setRows(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load invoices") }))
      .finally(() => setLoading(false));
  }, [notification]);

  const columns = [
    { title: "Invoice", dataIndex: "number", render: (v: string | null) => v ?? "—" },
    { title: "Product", render: (_: unknown, r: Invoice) => `${r.product.name} × ${r.quantity}` },
    { title: "Total", dataIndex: "total", align: "right" as const, render: formatRupees },
    { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={v === "PAID" ? "green" : "orange"}>{v}</Tag> },
    { title: "Paid", dataIndex: "paidAt", render: (v: string | null) => (v ? dayjs(v).format("D MMM YYYY") : "—") },
    { title: "", dataIndex: "invoiceUrl", render: (v: string | null) => (v ? <a href={invoiceHref(v)} target="_blank" rel="noreferrer">Invoice</a> : null) },
  ];
  return (
    <Card title="Invoices" size="small">
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 10 }} />
    </Card>
  );
}

export function BillingTab(props: BillingTabProps) {
  return (
    <>
      <BillingCard {...props} />
      <InvoicesCard />
    </>
  );
}
