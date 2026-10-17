import { useCallback, useEffect, useState } from "react";
import { App, Button, Form, Input, Modal, Popconfirm, Table, Tag } from "antd";
import { UserAddOutlined } from "@ant-design/icons";
import { List } from "@refinedev/antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { errorMessage } from "../marketing/utils";
import { BrandSelect } from "./brand-select";

interface Partner {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  createdAt: string;
  deletedAt: string | null;
  brand: { id: string; name: string };
}

interface PartnerValues { brandId: string; name: string; email: string; password: string; phone?: string }

function NewPartnerModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const { notification } = App.useApp();
  const [form] = Form.useForm<PartnerValues>();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await axiosInstance.post("/brand-campaigns/partners", { ...values, phone: values.phone || undefined });
      notification.success({ message: "Brand login created" });
      onCreated();
      onClose();
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not create the login") });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} title="New brand login" okText="Create" onOk={submit} onCancel={onClose} confirmLoading={saving} destroyOnHidden>
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item name="brandId" label="Brand" rules={[{ required: true }]}><BrandSelect /></Form.Item>
        <Form.Item name="name" label="Name" rules={[{ required: true, min: 2 }]}><Input maxLength={80} /></Form.Item>
        <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}><Input /></Form.Item>
        <Form.Item name="password" label="Password" rules={[{ required: true, min: 8 }]}><Input.Password maxLength={100} /></Form.Item>
        <Form.Item name="phone" label="Phone (optional)"><Input maxLength={15} /></Form.Item>
      </Form>
    </Modal>
  );
}

export const BrandPartners = () => {
  const { notification } = App.useApp();
  const [rows, setRows] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/brand-campaigns/partners");
      setRows(res.data.data);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not load brand logins") });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => { void load(); }, [load]);

  const remove = async (id: string) => {
    try {
      await axiosInstance.delete(`/brand-campaigns/partners/${id}`);
      await load();
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not remove the login") });
    }
  };

  const columns = [
    { title: "Brand", render: (_: unknown, p: Partner) => p.brand.name },
    { title: "Name", dataIndex: "name" },
    { title: "Email", dataIndex: "email" },
    { title: "Phone", dataIndex: "phone", render: (v: string | null) => v ?? "—" },
    { title: "Added", dataIndex: "createdAt", render: (v: string) => dayjs(v).format("D MMM YYYY") },
    {
      title: "",
      render: (_: unknown, p: Partner) =>
        p.deletedAt ? <Tag>Removed</Tag> : (
          <Popconfirm title="Remove this login?" okText="Remove" okButtonProps={{ danger: true }} onConfirm={() => remove(p.id)}>
            <Button size="small" danger>Remove</Button>
          </Popconfirm>
        ),
    },
  ];

  return (
    <List title="Brand partners" headerButtons={<Button type="primary" icon={<UserAddOutlined />} onClick={() => setCreating(true)}>New brand login</Button>}>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 25 }} />
      <NewPartnerModal open={creating} onClose={() => setCreating(false)} onCreated={load} />
    </List>
  );
};
