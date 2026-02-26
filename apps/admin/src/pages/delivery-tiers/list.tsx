import { useState, useEffect } from "react";
import { List, DeleteButton } from "@refinedev/antd";
import { useCustom, useApiUrl, useCreate, useUpdate } from "@refinedev/core";
import {
  Table,
  Select,
  Switch,
  Button,
  Modal,
  Form,
  InputNumber,
  Space,
  Typography,
  Tag,
  Empty,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface Store {
  id: string;
  name: string;
  deliveryRadius?: number;
  latitude?: number;
  longitude?: number;
}

interface DeliveryTier {
  id: string;
  storeId: string;
  minDistance: number;
  maxDistance: number;
  deliveryFee: number;
  estimatedMinutes: number;
  isActive: boolean;
}

export const DeliveryTierList = () => {
  const apiUrl = useApiUrl();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTier, setEditingTier] = useState<DeliveryTier | null>(null);
  const [form] = Form.useForm();

  const { mutate: create, isLoading: creating } = useCreate();
  const { mutate: update, isLoading: updating } = useUpdate();

  // Fetch stores for dropdown
  const { data: storesData } = useCustom<{ data: Store[] }>({
    url: `${apiUrl}/stores`,
    method: "get",
    config: { query: { pageSize: 100 } },
  });
  const stores = storesData?.data?.data ?? [];

  // Fetch tiers for selected store
  const { data: tiersData, refetch } = useCustom<{ data: DeliveryTier[] }>({
    url: `${apiUrl}/delivery-tiers`,
    method: "get",
    config: { query: { storeId: storeId ?? "", pageSize: 50 } },
    queryOptions: { enabled: !!storeId },
  });
  const tiers = tiersData?.data?.data ?? [];
  const selectedStore = stores.find((s) => s.id === storeId);

  useEffect(() => {
    if (storeId) refetch();
  }, [storeId]);

  const openCreate = () => {
    setEditingTier(null);
    form.resetFields();
    form.setFieldsValue({ estimatedMinutes: 45, isActive: true });
    setModalOpen(true);
  };

  const openEdit = (tier: DeliveryTier) => {
    setEditingTier(tier);
    form.setFieldsValue(tier);
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    if (editingTier) {
      update(
        { resource: "delivery-tiers", id: editingTier.id, values },
        { onSuccess: () => { setModalOpen(false); refetch(); } },
      );
    } else {
      create(
        { resource: "delivery-tiers", values: { ...values, storeId } },
        { onSuccess: () => { setModalOpen(false); refetch(); } },
      );
    }
  };

  const handleToggleActive = (tier: DeliveryTier, checked: boolean) => {
    update(
      { resource: "delivery-tiers", id: tier.id, values: { isActive: checked } },
      { onSuccess: () => refetch() },
    );
  };

  return (
    <List
      headerButtons={
        storeId
          ? [
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add Tier
              </Button>,
            ]
          : []
      }
    >
      <Space direction="vertical" style={{ width: "100%" }} size="middle">
        <Space>
          <Text strong>Store:</Text>
          <Select
            style={{ width: 300 }}
            placeholder="Select a store"
            value={storeId}
            onChange={setStoreId}
            showSearch
            optionFilterProp="label"
            options={stores.map((s) => ({ label: s.name, value: s.id }))}
            allowClear
          />
          {selectedStore && (
            <Space size="small">
              {selectedStore.latitude != null ? (
                <Tag color="green">
                  Location set ({selectedStore.latitude?.toFixed(4)}, {selectedStore.longitude?.toFixed(4)})
                </Tag>
              ) : (
                <Tag color="orange">No location configured</Tag>
              )}
              <Tag>Radius: {selectedStore.deliveryRadius ?? 7} km</Tag>
            </Space>
          )}
        </Space>

        {!storeId ? (
          <Empty description="Select a store to manage delivery tiers" />
        ) : (
          <Table dataSource={tiers} rowKey="id" size="small" pagination={false}>
            <Table.Column
              dataIndex="minDistance"
              title="Min Distance"
              render={(v: number) => `${v} km`}
            />
            <Table.Column
              dataIndex="maxDistance"
              title="Max Distance"
              render={(v: number) => `${v} km`}
            />
            <Table.Column
              title="Range"
              render={(_: unknown, r: DeliveryTier) => (
                <Tag color="blue">{r.minDistance}–{r.maxDistance} km</Tag>
              )}
            />
            <Table.Column
              dataIndex="deliveryFee"
              title="Delivery Fee"
              render={(v: number) => (Number(v) === 0 ? <Tag color="green">FREE</Tag> : `₹${Number(v)}`)}
            />
            <Table.Column
              dataIndex="estimatedMinutes"
              title="Est. Time"
              render={(v: number) => `${v} min`}
            />
            <Table.Column
              dataIndex="isActive"
              title="Active"
              render={(v: boolean, r: DeliveryTier) => (
                <Switch size="small" checked={v} onChange={(checked) => handleToggleActive(r, checked)} />
              )}
            />
            <Table.Column
              title="Actions"
              render={(_: unknown, r: DeliveryTier) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(r)}>Edit</Button>
                  <DeleteButton
                    size="small"
                    resource="delivery-tiers"
                    recordItemId={r.id}
                    hideText
                    onSuccess={() => refetch()}
                  />
                </Space>
              )}
            />
          </Table>
        )}
      </Space>

      <Modal
        title={editingTier ? "Edit Delivery Tier" : "Add Delivery Tier"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={creating || updating}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item
              label="Min Distance (km)"
              name="minDistance"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="Max Distance (km)"
              name="maxDistance"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <InputNumber min={0} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item
            label="Delivery Fee (₹)"
            name="deliveryFee"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={0} step={5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="Estimated Delivery Time (minutes)"
            name="estimatedMinutes"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={5} step={5} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </List>
  );
};
