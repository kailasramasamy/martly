import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Tag, Input, Select, DatePicker, Row, Col, Card, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useState } from "react";

import { ORDER_STATUS_CONFIG, PAYMENT_STATUS_CONFIG, FULFILLMENT_TYPE_CONFIG, FULFILLMENT_TYPE_OPTIONS } from "../../constants/tag-colors";

const statusOptions = Object.entries(ORDER_STATUS_CONFIG).map(([value, { label }]) => ({ label, value }));
const paymentStatusOptions = Object.entries(PAYMENT_STATUS_CONFIG).map(([value, { label }]) => ({ label, value }));
const paymentMethodOptions = [
  { label: "Online", value: "ONLINE" },
  { label: "Cash on Delivery", value: "COD" },
];

export const OrderList = () => {
  const [search, setSearch] = useState("");

  const { tableProps, setFilters, filters } = useTable({
    resource: "orders",
    syncWithLocation: true,
  });

  const currentFilters = filters ?? [];
  const getFilterValue = (field: string) => {
    const f = currentFilters.find((f) => "field" in f && f.field === field);
    return f && "value" in f ? f.value : undefined;
  };

  const handleSearch = (value: string) => {
    setSearch(value);
    setFilters([
      { field: "q", operator: "eq", value: value || undefined },
    ], "merge");
  };

  const handleFilter = (field: string, value: string | undefined) => {
    setFilters([
      { field, operator: "eq", value: value || undefined },
    ], "merge");
  };

  const handleDateRange = (_: unknown, dates: [string, string]) => {
    setFilters([
      { field: "dateFrom", operator: "eq", value: dates?.[0] || undefined },
      { field: "dateTo", operator: "eq", value: dates?.[1] || undefined },
    ], "merge");
  };

  return (
    <List>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Input
              placeholder="Search by order ID, customer name or email..."
              prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Status"
              options={statusOptions}
              value={getFilterValue("status")}
              onChange={(v) => handleFilter("status", v)}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={12} md={4}>
            <Select
              placeholder="Payment"
              options={paymentStatusOptions}
              value={getFilterValue("paymentStatus")}
              onChange={(v) => handleFilter("paymentStatus", v)}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={12} md={3}>
            <Select
              placeholder="Method"
              options={paymentMethodOptions}
              value={getFilterValue("paymentMethod")}
              onChange={(v) => handleFilter("paymentMethod", v)}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={12} md={3}>
            <Select
              placeholder="Fulfillment"
              options={FULFILLMENT_TYPE_OPTIONS}
              value={getFilterValue("fulfillmentType")}
              onChange={(v) => handleFilter("fulfillmentType", v)}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={12} md={4}>
            <DatePicker.RangePicker
              onChange={handleDateRange}
              style={{ width: "100%" }}
              placeholder={["From", "To"]}
            />
          </Col>
        </Row>
      </Card>

      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column
          dataIndex="id"
          title="Order ID"
          render={(v: string) => <span style={{ fontFamily: "monospace" }}>{v.slice(0, 8)}</span>}
          width={100}
        />
        <Table.Column
          dataIndex={["user", "name"]}
          title="Customer"
          render={(name: string, record: any) => (
            <div>
              <div style={{ fontWeight: 500 }}>{name ?? "—"}</div>
              {record.user?.email && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{record.user.email}</div>
              )}
            </div>
          )}
        />
        <Table.Column
          dataIndex="totalAmount"
          title="Total"
          width={100}
          render={(v: number) => <strong>₹{Number(v).toFixed(0)}</strong>}
          sorter
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
          dataIndex="fulfillmentType"
          title="Fulfillment"
          width={100}
          render={(value: string) => {
            const config = FULFILLMENT_TYPE_CONFIG[value];
            return config ? <Tag color={config.color}>{config.label}</Tag> : <Tag>Delivery</Tag>;
          }}
        />
        <Table.Column
          dataIndex="paymentMethod"
          title="Method"
          width={100}
          render={(value: string) => {
            if (value === "COD") return <Tag color="orange">COD</Tag>;
            return <Tag color="blue">Online</Tag>;
          }}
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
          sorter
        />
        <Table.Column
          title=""
          width={50}
          render={(_, record: { id: string }) => (
            <ShowButton hideText size="small" recordItemId={record.id} />
          )}
        />
      </Table>
    </List>
  );
};
