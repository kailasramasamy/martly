import { Show, ShowButton } from "@refinedev/antd";
import { useShow, useList } from "@refinedev/core";
import { useParams } from "react-router";
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
} from "antd";
import {
  UserOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  CalendarOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  CheckCircleFilled,
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
  const { query } = useShow({ resource: "users", id });
  const { data, isLoading } = query;
  const record = data?.data;

  const { data: ordersData, isLoading: ordersLoading } = useList({
    resource: "orders",
    filters: [{ field: "userId", operator: "eq", value: id }],
    pagination: { pageSize: 100 },
    queryOptions: { enabled: !!id },
  });

  const orders = (ordersData?.data ?? []) as unknown as OrderRecord[];
  const nonCancelledOrders = orders.filter((o) => o.status !== "CANCELLED");
  const totalSpent = nonCancelledOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
  const addresses = (record?.addresses as AddressRecord[] | undefined) ?? [];

  return (
    <Show isLoading={isLoading} canEdit={false} canDelete={false}>
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
                  precision={2}
                  prefix={<DollarOutlined style={{ color: BRAND.success }} />}
                />
              </Card>
            </Col>
            <Col xs={8}>
              <Card size="small">
                <Statistic
                  title="Avg. Order"
                  value={nonCancelledOrders.length > 0 ? totalSpent / nonCancelledOrders.length : 0}
                  precision={2}
                  prefix={<DollarOutlined style={{ color: BRAND.info }} />}
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
                    render={(v: string) => (
                      <Text copyable={{ text: v }} style={{ fontFamily: "monospace", fontSize: 12 }}>
                        {v.slice(0, 8)}
                      </Text>
                    )}
                  />
                  <Table.Column
                    dataIndex="status"
                    title="Status"
                    width={110}
                    render={(value: string) => {
                      const config = ORDER_STATUS_CONFIG[value];
                      return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
                    }}
                  />
                  <Table.Column
                    dataIndex="totalAmount"
                    title="Amount"
                    width={90}
                    align="right"
                    render={(v: number) => <Text strong>${Number(v).toFixed(2)}</Text>}
                  />
                  <Table.Column
                    dataIndex="paymentMethod"
                    title="Payment"
                    width={90}
                    render={(value: string) =>
                      value === "COD" ? <Tag color="orange">COD</Tag> : <Tag color="blue">Online</Tag>
                    }
                  />
                  <Table.Column
                    dataIndex="paymentStatus"
                    title="Pay Status"
                    width={90}
                    render={(value: string) => {
                      const config = PAYMENT_STATUS_CONFIG[value];
                      return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
                    }}
                  />
                  <Table.Column
                    dataIndex="createdAt"
                    title="Date"
                    width={110}
                    render={(value: string) => dayjs(value).format("DD MMM YYYY")}
                  />
                  <Table.Column
                    title=""
                    width={44}
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
    </Show>
  );
};
