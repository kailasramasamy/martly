import { useState, useEffect, useCallback } from "react";
import { App, Card, Table, Tag, Space, Button, Modal, Form, Input, InputNumber, Select, Switch, Spin, Typography } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, CrownOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { MEMBERSHIP_DURATION_CONFIG } from "../../constants/tag-colors";

const { Text } = Typography;

interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  duration: string;
  freeDelivery: boolean;
  loyaltyMultiplier: number;
  isActive: boolean;
  sortOrder: number;
}

export const MembershipPlans = () => {
  const { notification, modal } = App.useApp();
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<MembershipPlan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const fetchPlans = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/memberships/plans?pageSize=100");
      setPlans(res?.data?.data ?? []);
    } catch {
      notification.error({ message: "Failed to load membership plans" });
    } finally {
      setLoading(false);
    }
  }, [notification]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const openCreate = () => {
    setEditingPlan(null);
    form.resetFields();
    form.setFieldsValue({ freeDelivery: true, loyaltyMultiplier: 1, isActive: true, sortOrder: 0 });
    setModalOpen(true);
  };

  const openEdit = (plan: MembershipPlan) => {
    setEditingPlan(plan);
    form.setFieldsValue(plan);
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      if (editingPlan) {
        await axiosInstance.put(`/memberships/plans/${editingPlan.id}`, values);
        notification.success({ message: "Plan updated" });
      } else {
        await axiosInstance.post("/memberships/plans", values);
        notification.success({ message: "Plan created" });
      }
      setModalOpen(false);
      fetchPlans();
    } catch {
      notification.error({ message: "Failed to save plan" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (plan: MembershipPlan) => {
    modal.confirm({
      title: `Deactivate "${plan.name}"?`,
      content: "This will hide the plan from customers. Existing subscribers keep their membership.",
      onOk: async () => {
        try {
          await axiosInstance.delete(`/memberships/plans/${plan.id}`);
          notification.success({ message: "Plan deactivated" });
          fetchPlans();
        } catch {
          notification.error({ message: "Failed to deactivate plan" });
        }
      },
    });
  };

  if (loading) return <Spin size="large" style={{ display: "block", margin: "100px auto" }} />;

  return (
    <Card
      title={<Space><CrownOutlined style={{ color: "#7c3aed" }} /><Text strong>Membership Plans</Text></Space>}
      extra={<Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add Plan</Button>}
    >
      <Table dataSource={plans} rowKey="id" size="small" pagination={false}>
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="price" title="Price" render={(v: number) => `\u20B9${v}`} />
        <Table.Column dataIndex="duration" title="Duration" render={(v: string) => {
          const cfg = MEMBERSHIP_DURATION_CONFIG[v];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : v;
        }} />
        <Table.Column dataIndex="freeDelivery" title="Free Delivery" render={(v: boolean) => v ? <Tag color="green">Yes</Tag> : <Tag>No</Tag>} />
        <Table.Column dataIndex="loyaltyMultiplier" title="Loyalty Multiplier" render={(v: number) => `${v}x`} />
        <Table.Column dataIndex="isActive" title="Active" render={(v: boolean) => v ? <Tag color="green">Active</Tag> : <Tag>Inactive</Tag>} />
        <Table.Column dataIndex="sortOrder" title="Order" />
        <Table.Column title="Actions" render={(_, rec: MembershipPlan) => (
          <Space>
            <Button icon={<EditOutlined />} size="small" onClick={() => openEdit(rec)} />
            {rec.isActive && <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(rec)} />}
          </Space>
        )} />
      </Table>

      <Modal
        open={modalOpen}
        title={editingPlan ? "Edit Membership Plan" : "Create Membership Plan"}
        onOk={handleSave}
        onCancel={() => setModalOpen(false)}
        confirmLoading={saving}
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="Plan Name" rules={[{ required: true }]}>
            <Input placeholder="e.g. Mart Plus Monthly" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="Benefits description" />
          </Form.Item>
          <Form.Item name="price" label="Price (₹)" rules={[{ required: true }]}>
            <InputNumber min={1} step={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="duration" label="Duration" rules={[{ required: true }]}>
            <Select options={[
              { value: "MONTHLY", label: "Monthly (30 days)" },
              { value: "QUARTERLY", label: "Quarterly (90 days)" },
              { value: "ANNUAL", label: "Annual (365 days)" },
            ]} />
          </Form.Item>
          <Form.Item name="freeDelivery" label="Free Delivery" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="loyaltyMultiplier" label="Loyalty Points Multiplier" extra="e.g. 2 means 2x points on every order">
            <InputNumber min={1} max={10} step={0.5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="sortOrder" label="Sort Order">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="isActive" label="Active" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};
