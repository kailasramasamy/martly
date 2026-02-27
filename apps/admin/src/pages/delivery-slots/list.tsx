import { useState, useEffect } from "react";
import { List, DeleteButton } from "@refinedev/antd";
import { useCustom, useApiUrl, useUpdate } from "@refinedev/core";
import { axiosInstance } from "../../providers/data-provider";
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
  Checkbox,
  TimePicker,
  message,
} from "antd";
import { PlusOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Text } = Typography;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const DAY_COLORS = ["#f59e0b", "#3b82f6", "#06b6d4", "#8b5cf6", "#ec4899", "#22c55e", "#ef4444"];

interface Store {
  id: string;
  name: string;
}

interface DeliverySlot {
  id: string;
  storeId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  maxOrders: number;
  cutoffMinutes: number;
  isActive: boolean;
}

export const DeliverySlotList = () => {
  const apiUrl = useApiUrl();
  const [storeId, setStoreId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<DeliverySlot | null>(null);
  const [form] = Form.useForm();

  const [creating, setCreating] = useState(false);
  const { mutate: update, isLoading: updating } = useUpdate();

  // Fetch stores for dropdown
  const { data: storesData } = useCustom<{ data: Store[] }>({
    url: `${apiUrl}/stores`,
    method: "get",
    config: { query: { pageSize: 100 } },
  });
  const stores = storesData?.data?.data ?? [];

  // Fetch slots for selected store
  const { data: slotsData, refetch } = useCustom<{ data: DeliverySlot[] }>({
    url: `${apiUrl}/delivery-slots`,
    method: "get",
    config: { query: { storeId: storeId ?? "", pageSize: 200 } },
    queryOptions: { enabled: !!storeId },
  });
  const slots = slotsData?.data?.data ?? [];

  useEffect(() => {
    if (storeId) refetch();
  }, [storeId]);

  const openCreate = () => {
    setEditingSlot(null);
    form.resetFields();
    form.setFieldsValue({ maxOrders: 20, cutoffMinutes: 60, isActive: true, days: [] });
    setModalOpen(true);
  };

  const openEdit = (slot: DeliverySlot) => {
    setEditingSlot(slot);
    form.setFieldsValue({
      ...slot,
      startTime: dayjs(slot.startTime, "HH:mm"),
      endTime: dayjs(slot.endTime, "HH:mm"),
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    const startTime = values.startTime?.format?.("HH:mm") ?? values.startTime;
    const endTime = values.endTime?.format?.("HH:mm") ?? values.endTime;

    if (editingSlot) {
      update(
        {
          resource: "delivery-slots",
          id: editingSlot.id,
          values: {
            dayOfWeek: values.dayOfWeek,
            startTime,
            endTime,
            maxOrders: values.maxOrders,
            cutoffMinutes: values.cutoffMinutes,
            isActive: values.isActive,
          },
        },
        { onSuccess: () => { setModalOpen(false); refetch(); } },
      );
    } else {
      // Bulk create for multiple days — skip duplicates silently
      const days: number[] = values.days ?? [values.dayOfWeek];
      if (days.length === 0) return;

      setCreating(true);
      let created = 0;
      let skipped = 0;

      for (const day of days) {
        try {
          await axiosInstance.post("/delivery-slots", {
            storeId,
            dayOfWeek: day,
            startTime,
            endTime,
            maxOrders: values.maxOrders,
            cutoffMinutes: values.cutoffMinutes,
            isActive: values.isActive ?? true,
          });
          created++;
        } catch {
          skipped++;
        }
      }

      setCreating(false);
      setModalOpen(false);
      refetch();

      if (created > 0 && skipped > 0) {
        message.success(`Created ${created} slot(s), ${skipped} already existed`);
      } else if (created > 0) {
        message.success(`Created ${created} slot(s)`);
      } else {
        message.warning("All selected slots already exist");
      }
    }
  };

  const handleToggleActive = (slot: DeliverySlot, checked: boolean) => {
    update(
      { resource: "delivery-slots", id: slot.id, values: { isActive: checked } },
      { onSuccess: () => refetch() },
    );
  };

  return (
    <List
      headerButtons={
        storeId
          ? [
              <Button key="add" type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                Add Time Slot
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
        </Space>

        {!storeId ? (
          <Empty description="Select a store to manage delivery time slots" />
        ) : (
          <Table dataSource={slots} rowKey="id" size="small" pagination={false}>
            <Table.Column
              dataIndex="dayOfWeek"
              title="Day"
              render={(v: number) => (
                <Tag color={DAY_COLORS[v]}>{DAY_NAMES[v]}</Tag>
              )}
              sorter={(a: DeliverySlot, b: DeliverySlot) => a.dayOfWeek - b.dayOfWeek}
              defaultSortOrder="ascend"
            />
            <Table.Column
              title="Time Window"
              render={(_: unknown, r: DeliverySlot) => (
                <Text strong>{r.startTime} – {r.endTime}</Text>
              )}
            />
            <Table.Column
              dataIndex="maxOrders"
              title="Max Orders"
            />
            <Table.Column
              dataIndex="cutoffMinutes"
              title="Cutoff"
              render={(v: number) => `${v} min before`}
            />
            <Table.Column
              dataIndex="isActive"
              title="Active"
              render={(v: boolean, r: DeliverySlot) => (
                <Switch size="small" checked={v} onChange={(checked) => handleToggleActive(r, checked)} />
              )}
            />
            <Table.Column
              title="Actions"
              render={(_: unknown, r: DeliverySlot) => (
                <Space>
                  <Button size="small" onClick={() => openEdit(r)}>Edit</Button>
                  <DeleteButton
                    size="small"
                    resource="delivery-slots"
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
        title={editingSlot ? "Edit Time Slot" : "Add Time Slot"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={creating || updating}
      >
        <Form form={form} layout="vertical">
          {editingSlot ? (
            <Form.Item
              label="Day of Week"
              name="dayOfWeek"
              rules={[{ required: true, message: "Required" }]}
            >
              <Select
                options={DAY_NAMES.map((name, i) => ({ label: name, value: i }))}
              />
            </Form.Item>
          ) : (
            <Form.Item
              label="Days of Week"
              name="days"
              rules={[{ required: true, message: "Select at least one day" }]}
            >
              <Checkbox.Group
                options={DAY_NAMES.map((name, i) => ({ label: name, value: i }))}
              />
            </Form.Item>
          )}
          <Space style={{ width: "100%" }} size="middle">
            <Form.Item
              label="Start Time"
              name="startTime"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <TimePicker format="HH:mm" minuteStep={15} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item
              label="End Time"
              name="endTime"
              rules={[{ required: true, message: "Required" }]}
              style={{ flex: 1 }}
            >
              <TimePicker format="HH:mm" minuteStep={15} style={{ width: "100%" }} />
            </Form.Item>
          </Space>
          <Form.Item
            label="Max Orders per Slot"
            name="maxOrders"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={1} step={5} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            label="Cutoff (minutes before slot start)"
            name="cutoffMinutes"
            rules={[{ required: true, message: "Required" }]}
          >
            <InputNumber min={0} step={15} style={{ width: "100%" }} />
          </Form.Item>
        </Form>
      </Modal>
    </List>
  );
};
