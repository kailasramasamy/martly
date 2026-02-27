import { useState, useEffect, useCallback } from "react";
import {
  Table,
  Select,
  Button,
  Modal,
  Form,
  Input,
  Space,
  Typography,
  Tag,
  Empty,
  Popconfirm,
  message,
  Spin,
} from "antd";
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ShopOutlined,
  PhoneOutlined,
  MailOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { axiosInstance } from "../../providers/data-provider";

const { Text } = Typography;

interface Store {
  id: string;
  name: string;
}

interface TripStats {
  total: number;
  active: number;
  completed: number;
}

interface Rider {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  createdAt: string;
  tripStats: TripStats;
}

export const RidersList = () => {
  const [stores, setStores] = useState<Store[]>([]);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [riders, setRiders] = useState<Rider[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRider, setEditingRider] = useState<Rider | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  // Fetch stores on mount
  useEffect(() => {
    axiosInstance.get("/stores?pageSize=100").then((res) => {
      const list = res?.data?.data ?? [];
      setStores(list);
      if (list.length > 0) setStoreId(list[0].id);
    });
  }, []);

  // Fetch riders when store changes
  const fetchRiders = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/riders?storeId=${storeId}`);
      setRiders(res?.data?.data ?? []);
    } catch {
      setRiders([]);
    } finally {
      setLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchRiders();
  }, [fetchRiders]);

  const openCreate = () => {
    setEditingRider(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (rider: Rider) => {
    setEditingRider(rider);
    form.setFieldsValue({
      name: rider.name,
      phone: rider.phone ?? "",
      email: rider.email,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      if (editingRider) {
        const payload: Record<string, string> = {};
        if (values.name !== editingRider.name) payload.name = values.name;
        if (values.phone !== (editingRider.phone ?? "")) payload.phone = values.phone;
        if (values.email !== editingRider.email) payload.email = values.email;
        if (values.password) payload.password = values.password;

        await axiosInstance.put(`/riders/${editingRider.id}?storeId=${storeId}`, payload);
        message.success("Rider updated");
      } else {
        await axiosInstance.post("/riders", { ...values, storeId });
        message.success("Rider added");
      }
      setModalOpen(false);
      fetchRiders();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to save rider");
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (rider: Rider) => {
    try {
      await axiosInstance.delete(`/riders/${rider.id}?storeId=${storeId}`);
      message.success(`${rider.name} removed from store`);
      fetchRiders();
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to remove rider");
    }
  };

  const columns = [
    {
      title: "Name",
      dataIndex: "name",
      key: "name",
      render: (name: string) => <Text strong>{name}</Text>,
    },
    {
      title: "Phone",
      dataIndex: "phone",
      key: "phone",
      render: (phone: string | null) =>
        phone ? (
          <Space size={4}>
            <PhoneOutlined style={{ fontSize: 12, color: "#64748b" }} />
            <span>{phone}</span>
          </Space>
        ) : (
          <Text type="secondary">{"\u2014"}</Text>
        ),
    },
    {
      title: "Email",
      dataIndex: "email",
      key: "email",
      render: (email: string) => (
        <Space size={4}>
          <MailOutlined style={{ fontSize: 12, color: "#64748b" }} />
          <span>{email}</span>
        </Space>
      ),
    },
    {
      title: "Trips",
      key: "trips",
      width: 200,
      render: (_: unknown, rec: Rider) => (
        <Space size={4}>
          <Tag>{rec.tripStats.total} total</Tag>
          {rec.tripStats.active > 0 && (
            <Tag color="processing">{rec.tripStats.active} active</Tag>
          )}
          {rec.tripStats.completed > 0 && (
            <Tag color="success">{rec.tripStats.completed} done</Tag>
          )}
        </Space>
      ),
    },
    {
      title: "Added On",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 120,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {dayjs(v).format("DD MMM YYYY")}
        </Text>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 120,
      render: (_: unknown, rec: Rider) => (
        <Space size={4}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openEdit(rec)}
          />
          <Popconfirm
            title="Remove rider from this store?"
            description={
              rec.tripStats.active > 0
                ? "This rider has active trips and cannot be removed."
                : `${rec.name} will be unassigned from this store.`
            }
            onConfirm={() => handleRemove(rec)}
            okText="Remove"
            okButtonProps={{ danger: true, disabled: rec.tripStats.active > 0 }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={rec.tripStats.active > 0}
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Riders</h2>
        <Space size={8}>
          <Select
            placeholder="Select store"
            value={storeId}
            onChange={(v) => setStoreId(v)}
            style={{ minWidth: 200 }}
            options={stores.map((s) => ({ label: s.name, value: s.id }))}
            suffixIcon={<ShopOutlined />}
          />
          {storeId && (
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
              Add Rider
            </Button>
          )}
        </Space>
      </div>

      {!storeId ? (
        <Empty description="Select a store to manage riders" />
      ) : (
        <Spin spinning={loading}>
          <Table
            dataSource={riders}
            columns={columns}
            rowKey="id"
            size="small"
            pagination={false}
            locale={{
              emptyText: (
                <Empty description="No riders assigned to this store" />
              ),
            }}
          />
        </Spin>
      )}

      <Modal
        title={editingRider ? "Edit Rider" : "Add Rider"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            label="Name"
            name="name"
            rules={[
              { required: true, message: "Name is required" },
              { min: 2, message: "At least 2 characters" },
            ]}
          >
            <Input placeholder="Rider's full name" />
          </Form.Item>
          <Form.Item
            label="Phone"
            name="phone"
            rules={[
              { required: true, message: "Phone is required" },
              { min: 10, message: "At least 10 digits" },
            ]}
          >
            <Input placeholder="10-digit phone number" />
          </Form.Item>
          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: "Email is required" },
              { type: "email", message: "Enter a valid email" },
            ]}
          >
            <Input placeholder="rider@example.com" />
          </Form.Item>
          <Form.Item
            label={editingRider ? "New Password (leave blank to keep)" : "Password"}
            name="password"
            rules={
              editingRider
                ? [{ min: 6, message: "At least 6 characters" }]
                : [
                    { required: true, message: "Password is required" },
                    { min: 6, message: "At least 6 characters" },
                  ]
            }
          >
            <Input.Password placeholder={editingRider ? "Leave blank to keep current" : "Min 6 characters"} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
