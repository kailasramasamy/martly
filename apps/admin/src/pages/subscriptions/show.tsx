import { useState, useEffect } from "react";
import { useParams } from "react-router";
import {
  Descriptions,
  Card,
  Table,
  Tag,
  Row,
  Col,
  Spin,
  Space,
  Typography,
  Button,
  InputNumber,
  Modal,
  DatePicker,
  message,
} from "antd";
import {
  CalendarOutlined,
  ShoppingOutlined,
  HistoryOutlined,
  FileTextOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  EditOutlined,
  SaveOutlined,
  CloseOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import {
  SUBSCRIPTION_STATUS_CONFIG,
  SUBSCRIPTION_FREQUENCY_CONFIG,
  ORDER_STATUS_CONFIG,
} from "../../constants/tag-colors";

const { Text } = Typography;

const DAY_LABELS: Record<number, string> = {
  0: "Sunday",
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
};

export const SubscriptionShow = () => {
  const { id } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [editingItems, setEditingItems] = useState(false);
  const [editedQtys, setEditedQtys] = useState<Record<string, number>>({});
  const [pauseModalOpen, setPauseModalOpen] = useState(false);
  const [pauseUntil, setPauseUntil] = useState<dayjs.Dayjs | null>(null);

  const fetchData = () => {
    if (!id) {
      setLoading(false);
      return;
    }
    axiosInstance
      .get(`/subscriptions/admin/${id}`)
      .then((res) => setData(res?.data?.data ?? null))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleAction = async (body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await axiosInstance.put(`/subscriptions/admin/${id}`, body);
      setData(res?.data?.data ?? null);
      message.success("Subscription updated");
    } catch {
      message.error("Failed to update subscription");
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = () => {
    handleAction({
      status: "PAUSED",
      ...(pauseUntil ? { pausedUntil: pauseUntil.toISOString() } : {}),
    });
    setPauseModalOpen(false);
    setPauseUntil(null);
  };

  const handleResume = () => handleAction({ status: "ACTIVE" });

  const handleCancel = () => {
    Modal.confirm({
      title: "Cancel Subscription",
      content: "This will permanently cancel the subscription. The customer will need to create a new one.",
      okText: "Yes, Cancel",
      okButtonProps: { danger: true },
      onOk: () => handleAction({ status: "CANCELLED" }),
    });
  };

  const startEditingItems = () => {
    const qtys: Record<string, number> = {};
    for (const item of data.items ?? []) {
      qtys[item.storeProductId] = item.quantity;
    }
    setEditedQtys(qtys);
    setEditingItems(true);
  };

  const saveItemQtys = () => {
    const items = Object.entries(editedQtys).map(([storeProductId, quantity]) => ({
      storeProductId,
      quantity,
    }));
    handleAction({ items }).then(() => setEditingItems(false));
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return <Text type="secondary">Subscription not found.</Text>;
  }

  const statusCfg = SUBSCRIPTION_STATUS_CONFIG[data.status] ?? {
    color: "default",
    label: data.status,
  };
  const freqCfg = SUBSCRIPTION_FREQUENCY_CONFIG[data.frequency] ?? {
    color: "default",
    label: data.frequency,
  };

  const isActive = data.status === "ACTIVE";
  const isPaused = data.status === "PAUSED";
  const isCancelled = data.status === "CANCELLED";

  // Map items from API shape
  const items = (data.items ?? []).map((item: any) => ({
    id: item.id,
    storeProductId: item.storeProductId,
    productName: item.storeProduct?.product?.name ?? "\u2014",
    variantName: item.storeProduct?.variant?.name ?? "",
    unitSize:
      item.storeProduct?.variant?.unitValue && item.storeProduct?.variant?.unitType
        ? `${item.storeProduct.variant.unitValue}${item.storeProduct.variant.unitType}`
        : "",
    quantity: item.quantity,
    price: Number(item.storeProduct?.price ?? 0),
  }));

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto" }}>
      <div
        style={{
          marginBottom: 24,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h2 style={{ margin: 0 }}>
            <Space>
              <CalendarOutlined style={{ color: "#0d9488" }} />
              Subscription Detail
            </Space>
          </h2>
          <Text type="secondary" style={{ fontFamily: "monospace" }}>
            {data.id}
          </Text>
        </div>
        {!isCancelled && (
          <Space>
            {isActive && (
              <Button
                icon={<PauseCircleOutlined />}
                onClick={() => setPauseModalOpen(true)}
                loading={actionLoading}
              >
                Pause
              </Button>
            )}
            {isPaused && (
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleResume}
                loading={actionLoading}
              >
                Resume
              </Button>
            )}
            <Button
              danger
              icon={<StopOutlined />}
              onClick={handleCancel}
              loading={actionLoading}
            >
              Cancel
            </Button>
          </Space>
        )}
      </div>

      <Row gutter={[16, 16]}>
        {/* Details */}
        <Col xs={24}>
          <Card title={sectionTitle(<FileTextOutlined />, "Details")} size="small">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
              <Descriptions.Item label="Customer">
                <div>
                  <div style={{ fontWeight: 500 }}>{data.user?.name}</div>
                  {data.user?.phone && (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{data.user.phone}</div>
                  )}
                  {data.user?.email && (
                    <div style={{ fontSize: 12, color: "#94a3b8" }}>{data.user.email}</div>
                  )}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Store">{data.store?.name}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusCfg.color}>{statusCfg.label}</Tag>
                {isPaused && data.pausedUntil && (
                  <Text type="secondary" style={{ fontSize: 12, marginLeft: 6 }}>
                    until {dayjs(data.pausedUntil).format("DD MMM YYYY")}
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Frequency">
                <Tag color={freqCfg.color}>{freqCfg.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Selected Days">
                {data.selectedDays?.length > 0
                  ? data.frequency === "MONTHLY"
                    ? `Day ${data.selectedDays[0]} of month`
                    : data.selectedDays.map((d: number) => DAY_LABELS[d] ?? d).join(", ")
                  : "\u2014"}
              </Descriptions.Item>
              <Descriptions.Item label="Delivery Address">
                {data.deliveryAddress ?? "\u2014"}
              </Descriptions.Item>
              <Descriptions.Item label="Next Delivery">
                {data.nextDeliveryDate
                  ? dayjs(data.nextDeliveryDate).format("DD MMM YYYY")
                  : "\u2014"}
              </Descriptions.Item>
              <Descriptions.Item label="Auto-pay">
                <Tag color={data.autoPayWithWallet ? "green" : "default"}>
                  {data.autoPayWithWallet ? "Yes" : "No"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Created">
                {data.createdAt ? new Date(data.createdAt).toLocaleString() : "\u2014"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Items */}
        <Col xs={24}>
          <Card
            title={sectionTitle(<ShoppingOutlined />, "Items")}
            size="small"
            extra={
              !isCancelled &&
              (editingItems ? (
                <Space>
                  <Button
                    size="small"
                    icon={<CloseOutlined />}
                    onClick={() => setEditingItems(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="small"
                    type="primary"
                    icon={<SaveOutlined />}
                    onClick={saveItemQtys}
                    loading={actionLoading}
                  >
                    Save
                  </Button>
                </Space>
              ) : (
                <Button
                  size="small"
                  icon={<EditOutlined />}
                  onClick={startEditingItems}
                >
                  Edit Quantities
                </Button>
              ))
            }
          >
            <Table
              dataSource={items}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: "Product",
                  dataIndex: "productName",
                  key: "productName",
                },
                {
                  title: "Variant",
                  key: "variant",
                  render: (_: unknown, record: any) =>
                    record.variantName || "\u2014",
                },
                {
                  title: "Qty",
                  dataIndex: "quantity",
                  key: "quantity",
                  width: 120,
                  render: (qty: number, record: any) =>
                    editingItems ? (
                      <InputNumber
                        min={1}
                        max={99}
                        value={editedQtys[record.storeProductId] ?? qty}
                        onChange={(v) =>
                          setEditedQtys((prev) => ({
                            ...prev,
                            [record.storeProductId]: v ?? 1,
                          }))
                        }
                        size="small"
                        style={{ width: 80 }}
                      />
                    ) : (
                      qty
                    ),
                },
                {
                  title: "Price",
                  dataIndex: "price",
                  key: "price",
                  width: 120,
                  render: (v: number) => `\u20B9${v.toFixed(0)}`,
                },
              ]}
            />
          </Card>
        </Col>

        {/* Skip History */}
        {data.skippedDates?.length > 0 && (
          <Col xs={24}>
            <Card title={sectionTitle(<HistoryOutlined />, "Skip History")} size="small">
              <Table
                dataSource={data.skippedDates}
                rowKey="id"
                pagination={false}
                size="small"
                columns={[
                  {
                    title: "Date",
                    dataIndex: "date",
                    key: "date",
                    width: 160,
                    render: (v: string) =>
                      v ? dayjs(v).format("DD MMM YYYY") : "\u2014",
                  },
                  {
                    title: "Reason",
                    dataIndex: "reason",
                    key: "reason",
                    render: (v: string | null) => v ?? "\u2014",
                  },
                ]}
              />
            </Card>
          </Col>
        )}

        {/* Order History */}
        {data.orders?.length > 0 && (
          <Col xs={24}>
            <Card title={sectionTitle(<ShoppingOutlined />, "Order History")} size="small">
              <Table
                dataSource={data.orders}
                rowKey="id"
                pagination={data.orders.length > 10 ? { pageSize: 10 } : false}
                size="small"
                columns={[
                  {
                    title: "Order ID",
                    dataIndex: "id",
                    key: "id",
                    width: 100,
                    render: (v: string) => (
                      <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                        {v.slice(0, 8)}
                      </span>
                    ),
                  },
                  {
                    title: "Total",
                    dataIndex: "totalAmount",
                    key: "totalAmount",
                    width: 120,
                    render: (v: number) => (
                      <strong>{`\u20B9${Number(v).toFixed(0)}`}</strong>
                    ),
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    key: "status",
                    width: 140,
                    render: (value: string) => {
                      const config = ORDER_STATUS_CONFIG[value];
                      return (
                        <Tag color={config?.color ?? "default"}>
                          {config?.label ?? value}
                        </Tag>
                      );
                    },
                  },
                  {
                    title: "Created",
                    dataIndex: "createdAt",
                    key: "createdAt",
                    width: 200,
                    render: (v: string) =>
                      v
                        ? new Date(v).toLocaleString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "\u2014",
                  },
                ]}
              />
            </Card>
          </Col>
        )}
      </Row>

      {/* Pause Modal */}
      <Modal
        title="Pause Subscription"
        open={pauseModalOpen}
        onCancel={() => {
          setPauseModalOpen(false);
          setPauseUntil(null);
        }}
        onOk={handlePause}
        okText="Pause"
        confirmLoading={actionLoading}
      >
        <p>Pause this subscription. Deliveries will be skipped until resumed.</p>
        <div style={{ marginTop: 12 }}>
          <Text strong>Resume automatically on (optional):</Text>
          <div style={{ marginTop: 8 }}>
            <DatePicker
              value={pauseUntil}
              onChange={setPauseUntil}
              disabledDate={(d) => d.isBefore(dayjs(), "day")}
              style={{ width: "100%" }}
              placeholder="Leave empty to pause indefinitely"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
