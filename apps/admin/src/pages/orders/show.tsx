import { Show } from "@refinedev/antd";
import { useShow } from "@refinedev/core";
import { Tag, Table, Card, Descriptions, Row, Col } from "antd";
import {
  FileTextOutlined,
  CreditCardOutlined,
  ShoppingOutlined,
} from "@ant-design/icons";

import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG } from "../../constants/tag-colors";
import { sectionTitle } from "../../theme";

interface OrderItem {
  id: string;
  productId: string;
  product?: { name?: string };
  variant?: { name?: string; unitValue?: string; unitType?: string };
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

export const OrderShow = () => {
  const { query } = useShow({ resource: "orders" });
  const record = query?.data?.data;

  if (!record) return null;

  const statusConfig = ORDER_STATUS_CONFIG[record.status] ?? { color: "default", label: record.status };
  const paymentConfig = PAYMENT_STATUS_CONFIG[record.paymentStatus] ?? { color: "default", label: record.paymentStatus };

  return (
    <Show>
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<FileTextOutlined />, "Order Summary")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Order ID">{record.id}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusConfig.color}>{statusConfig.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Total Amount">${record.totalAmount}</Descriptions.Item>
              <Descriptions.Item label="Created">
                {record.createdAt ? new Date(record.createdAt).toLocaleString() : "—"}
              </Descriptions.Item>
              <Descriptions.Item label="Last Updated">
                {record.updatedAt ? new Date(record.updatedAt).toLocaleString() : "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<CreditCardOutlined />, "Payment & Delivery")} size="small">
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="Payment Status">
                <Tag color={paymentConfig.color}>{paymentConfig.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Delivery Address">
                {record.deliveryAddress ?? "—"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24}>
          <Card title={sectionTitle(<ShoppingOutlined />, "Items")} size="small">
            <Table<OrderItem>
              dataSource={record.items ?? []}
              rowKey="id"
              pagination={false}
              size="small"
              columns={[
                {
                  title: "Product",
                  key: "product",
                  render: (_, item) => item.product?.name ?? item.productId,
                },
                {
                  title: "Variant",
                  key: "variant",
                  render: (_, item) => {
                    if (!item.variant) return "—";
                    const parts = [item.variant.name];
                    if (item.variant.unitValue && item.variant.unitType) {
                      parts.push(`(${item.variant.unitValue} ${item.variant.unitType})`);
                    }
                    return parts.join(" ");
                  },
                },
                {
                  title: "Qty",
                  dataIndex: "quantity",
                  key: "quantity",
                  width: 80,
                },
                {
                  title: "Unit Price",
                  dataIndex: "unitPrice",
                  key: "unitPrice",
                  width: 120,
                  render: (v: number) => `$${Number(v).toFixed(2)}`,
                },
                {
                  title: "Total",
                  dataIndex: "totalPrice",
                  key: "totalPrice",
                  width: 120,
                  render: (v: number) => `$${Number(v).toFixed(2)}`,
                },
              ]}
              summary={() => (
                <Table.Summary.Row>
                  <Table.Summary.Cell index={0} colSpan={3} />
                  <Table.Summary.Cell index={1}>
                    <strong>Order Total</strong>
                  </Table.Summary.Cell>
                  <Table.Summary.Cell index={2}>
                    <strong>${Number(record.totalAmount).toFixed(2)}</strong>
                  </Table.Summary.Cell>
                </Table.Summary.Row>
              )}
            />
          </Card>
        </Col>
      </Row>
    </Show>
  );
};
