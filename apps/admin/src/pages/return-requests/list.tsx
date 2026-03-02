import { useState } from "react";
import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Tag, Input, Select, Card, Row, Col, Space } from "antd";
import { SearchOutlined } from "@ant-design/icons";

import { RETURN_REQUEST_STATUS_CONFIG } from "../../constants/tag-colors";

const statusOptions = Object.entries(RETURN_REQUEST_STATUS_CONFIG).map(([value, { label }]) => ({ label, value }));

export const ReturnRequestList = () => {
  const [search, setSearch] = useState("");

  const { tableProps, setFilters, filters } = useTable({
    resource: "return-requests",
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
      { field: "search", operator: "eq", value: value || undefined },
    ], "merge");
  };

  const handleFilter = (field: string, value: string | undefined) => {
    setFilters([
      { field, operator: "eq", value: value || undefined },
    ], "merge");
  };

  return (
    <List>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={10}>
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
        </Row>
      </Card>

      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column
          dataIndex={["order", "id"]}
          title="Order ID"
          render={(v: string) => v ? <span style={{ fontFamily: "monospace" }}>{v.slice(0, 8)}</span> : "\u2014"}
          width={100}
        />
        <Table.Column
          dataIndex={["user", "name"]}
          title="Customer"
          render={(name: string, record: any) => (
            <div>
              <div style={{ fontWeight: 500 }}>{name ?? "\u2014"}</div>
              {record.user?.email && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{record.user.email}</div>
              )}
            </div>
          )}
        />
        <Table.Column
          dataIndex={["store", "name"]}
          title="Store"
          render={(v: string) => v ?? "\u2014"}
        />
        <Table.Column
          dataIndex="reason"
          title="Reason"
          ellipsis
        />
        <Table.Column
          dataIndex="requestedAmount"
          title="Amount"
          width={100}
          render={(v: number) => <strong>{"\u20B9"}{Number(v).toLocaleString("en-IN", { maximumFractionDigits: 0 })}</strong>}
        />
        <Table.Column
          dataIndex="status"
          title="Status"
          width={110}
          render={(value: string) => {
            const cfg = RETURN_REQUEST_STATUS_CONFIG[value] ?? { color: "default", label: value };
            return <Tag color={cfg.color}>{cfg.label}</Tag>;
          }}
        />
        <Table.Column
          dataIndex="createdAt"
          title="Date"
          width={160}
          render={(v: string) => v ? new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "\u2014"}
        />
        <Table.Column
          title=""
          width={50}
          render={(_: unknown, record: { id: string }) => (
            <ShowButton hideText size="small" recordItemId={record.id} />
          )}
        />
      </Table>
    </List>
  );
};
