import { useState } from "react";
import { Show, ShowButton } from "@refinedev/antd";
import { useShow, useList, useDelete } from "@refinedev/core";
import { useParams, useNavigate } from "react-router";
import {
  Typography,
  Descriptions,
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Avatar,
  Space,
  Empty,
  Button,
  Modal,
  Alert,
  Steps,
  Spin,
} from "antd";
import {
  UserOutlined,
  ShoppingCartOutlined,
  CalendarOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  CheckCircleFilled,
  CreditCardOutlined,
  DollarOutlined,
  DeleteOutlined,
  ExclamationCircleFilled,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "../../constants/tag-colors";
import { sectionTitle, BRAND } from "../../theme";

const { Text } = Typography;

interface AddressRecord {
  id: string;
  label: string;
  address: string;
  isDefault: boolean;
}

interface OrderRecord {
  id: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  createdAt: string;
  items?: { id: string }[];
}

export const CustomerShow = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { query } = useShow({ resource: "users", id });
  const { data, isLoading } = query;
  const record = data?.data;
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);

  const { mutate: deleteUser, isLoading: isDeleting } = useDelete();

  const { data: ordersData, isLoading: ordersLoading } = useList({
    resource: "orders",
    filters: [{ field: "userId", operator: "eq", value: id }],
    pagination: { pageSize: 100 },
    sorters: [{ field: "createdAt", order: "desc" }],
    queryOptions: { enabled: !!id },
  });

  const orders = (ordersData?.data ?? []) as unknown as OrderRecord[];
  const nonCancelledOrders = orders.filter((o) => o.status !== "CANCELLED");
  const totalSpent = nonCancelledOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const addresses = (record?.addresses as AddressRecord[] | undefined) ?? [];
  const reviewCount = (record as any)?._count?.reviews ?? 0;

  const handleDelete = () => {
    if (!id) return;
    deleteUser(
      { resource: "users", id },
      {
        onSuccess: () => {
          setDeleteModalOpen(false);
          navigate("/customers");
        },
      },
    );
  };

  return (
    <Show
      isLoading={isLoading}
      canEdit={false}
      canDelete={false}
      headerButtons={
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => setDeleteModalOpen(true)}
        >
          Delete Customer
        </Button>
      }
    >
      <Row gutter={[16, 16]}>
        {/* Left sidebar: Profile + Addresses */}
        <Col xs={24} lg={7}>
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card size="small">
                <div style={{ textAlign: "center", padding: "12px 0 4px" }}>
                  <Avatar
                    size={64}
                    icon={<UserOutlined />}
                    style={{ backgroundColor: BRAND.primary, marginBottom: 10 }}
                  />
                  <Typography.Title level={5} style={{ marginBottom: 2 }}>
                    {record?.name}
                  </Typography.Title>
                  <Text type="secondary" style={{ fontSize: 12 }}>Customer</Text>
                </div>
                <Descriptions column={1} size="small" style={{ marginTop: 12 }}>
                  <Descriptions.Item label={<><MailOutlined /> Email</>}>
                    {record?.email}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><PhoneOutlined /> Phone</>}>
                    {record?.phone || "—"}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><CalendarOutlined /> Joined</>}>
                    {record?.createdAt ? dayjs(record.createdAt).format("DD MMM YYYY") : "—"}
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
            <Col span={24}>
              <Card
                title={sectionTitle(<EnvironmentOutlined />, "Addresses")}
                size="small"
              >
                {addresses.length ? (
                  <Space direction="vertical" size={8} style={{ width: "100%" }}>
                    {addresses.map((addr) => (
                      <div
                        key={addr.id}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          border: "1px solid",
                          borderColor: addr.isDefault ? BRAND.primary : "var(--ant-color-border)",
                          background: addr.isDefault ? "var(--ant-color-primary-bg)" : undefined,
                        }}
                      >
                        <Space size={4} style={{ marginBottom: 2 }}>
                          <Text strong style={{ fontSize: 13 }}>{addr.label}</Text>
                          {addr.isDefault && (
                            <Tag
                              color="green"
                              icon={<CheckCircleFilled />}
                              style={{ marginInlineEnd: 0, fontSize: 11, lineHeight: "18px", padding: "0 4px" }}
                            >
                              Default
                            </Tag>
                          )}
                        </Space>
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {addr.address}
                          </Text>
                        </div>
                      </div>
                    ))}
                  </Space>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No addresses saved" />
                )}
              </Card>
            </Col>
          </Row>
        </Col>

        {/* Right main area: Stats + Orders */}
        <Col xs={24} lg={17}>
          <Row gutter={[12, 16]}>
            <Col xs={8}>
              <Card size="small">
                <Statistic
                  title="Total Orders"
                  value={record?._count?.orders ?? 0}
                  prefix={<ShoppingCartOutlined style={{ color: BRAND.primary }} />}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card size="small">
                <Statistic
                  title="Total Spent"
                  value={totalSpent}
                  precision={0}
                  prefix={<><CreditCardOutlined style={{ color: BRAND.success }} /> ₹</>}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card size="small">
                <Statistic
                  title="Avg. Order"
                  value={nonCancelledOrders.length > 0 ? totalSpent / nonCancelledOrders.length : 0}
                  precision={0}
                  prefix={<><DollarOutlined style={{ color: BRAND.info }} /> ₹</>}
                />
              </Card>
            </Col>
            <Col span={24}>
              <Card
                title={sectionTitle(<ShoppingCartOutlined />, "Order History")}
                size="small"
              >
                <Table<OrderRecord>
                  dataSource={orders}
                  rowKey="id"
                  loading={ordersLoading}
                  size="small"
                  pagination={orders.length > 10 ? { pageSize: 10 } : false}
                  locale={{
                    emptyText: (
                      <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description="No orders yet"
                      />
                    ),
                  }}
                >
                  <Table.Column
                    dataIndex="id"
                    title="Order ID"
                    width={100}
                    render={(v: string) => (
                      <span style={{ fontFamily: "monospace", fontSize: 12 }}>
                        {v.slice(0, 8)}
                      </span>
                    )}
                  />
                  <Table.Column
                    dataIndex="totalAmount"
                    title="Amount"
                    width={100}
                    render={(v: number) => <strong>₹{Number(v).toFixed(0)}</strong>}
                  />
                  <Table.Column
                    dataIndex="status"
                    title="Status"
                    width={140}
                    render={(value: string) => {
                      const config = ORDER_STATUS_CONFIG[value];
                      return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
                    }}
                  />
                  <Table.Column
                    dataIndex="paymentMethod"
                    title="Method"
                    width={100}
                    render={(value: string) =>
                      value === "COD" ? <Tag color="orange">COD</Tag> : <Tag color="blue">Online</Tag>
                    }
                  />
                  <Table.Column
                    dataIndex="paymentStatus"
                    title="Payment"
                    width={100}
                    render={(value: string) => {
                      const config = PAYMENT_STATUS_CONFIG[value];
                      return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
                    }}
                  />
                  <Table.Column
                    dataIndex="createdAt"
                    title="Date"
                    width={160}
                    render={(v: string) => v ? new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}
                  />
                  <Table.Column
                    title=""
                    width={50}
                    render={(_, rec: OrderRecord) => (
                      <ShowButton hideText size="small" recordItemId={rec.id} resource="orders" />
                    )}
                  />
                </Table>
              </Card>
            </Col>
          </Row>
        </Col>
      </Row>
      <Modal
        title={
          <Space>
            <ExclamationCircleFilled style={{ color: "#ff4d4f" }} />
            <span>Delete Customer</span>
          </Space>
        }
        open={deleteModalOpen}
        onCancel={isDeleting ? undefined : () => setDeleteModalOpen(false)}
        closable={!isDeleting}
        maskClosable={!isDeleting}
        keyboard={!isDeleting}
        footer={isDeleting ? null : [
          <Button key="cancel" onClick={() => setDeleteModalOpen(false)}>
            Cancel
          </Button>,
          <Button
            key="delete"
            danger
            type="primary"
            onClick={handleDelete}
          >
            Delete Permanently
          </Button>,
        ]}
      >
        {isDeleting ? (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <Spin size="large" />
            <div style={{ marginTop: 20 }}>
              <Typography.Title level={5} style={{ marginBottom: 4 }}>
                Deleting customer data...
              </Typography.Title>
              <Text type="secondary">
                Removing orders, reviews, addresses, and all associated records
              </Text>
            </div>
            <Steps
              direction="vertical"
              size="small"
              current={-1}
              status="process"
              style={{ marginTop: 24, textAlign: "left", maxWidth: 300, margin: "24px auto 0" }}
              items={[
                { title: "Removing orders & items", status: "process" },
                { title: "Removing reviews", status: "wait" },
                { title: "Removing addresses & tokens", status: "wait" },
                { title: "Deleting account", status: "wait" },
              ]}
            />
          </div>
        ) : (
          <>
            <Alert
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
              message="This action is irreversible"
              description="All data associated with this customer will be permanently deleted."
            />
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Customer">{record?.name || "—"}</Descriptions.Item>
              <Descriptions.Item label="Phone">{record?.phone || record?.email || "—"}</Descriptions.Item>
              <Descriptions.Item label="Orders">{orders.length} order(s) + all items & status logs</Descriptions.Item>
              <Descriptions.Item label="Addresses">{addresses.length} saved address(es)</Descriptions.Item>
              <Descriptions.Item label="Reviews">{reviewCount} review(s)</Descriptions.Item>
              <Descriptions.Item label="Also removed">Wishlist, device tokens, coupon usage</Descriptions.Item>
            </Descriptions>
          </>
        )}
      </Modal>
    </Show>
  );
};
