import { useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { List, useTable } from "@refinedev/antd";
import { Table, Tag, Select, Card, Row, Col, Button } from "antd";
import { PlusOutlined } from "@ant-design/icons";
import { Link } from "react-router";
import dayjs from "dayjs";
import { can } from "@martly/shared/permissions";

import { COUNT_STATUS_CONFIG } from "../../constants/tag-colors";
import { StoreSelect } from "../../components/StoreSelect";
import { NewCountModal } from "./new-count-modal";

const statusOptions = Object.entries(COUNT_STATUS_CONFIG).map(([value, { label }]) => ({ label, value }));

export const StockCountList = () => {
  const { data: identity } = useGetIdentity<{ role: string; permissions?: string[] }>();
  const [modalOpen, setModalOpen] = useState(false);
  const { tableProps, setFilters, filters } = useTable({
    resource: "stock/counts",
    pagination: { pageSize: 25 },
    syncWithLocation: true,
  });

  const getFilterValue = (field: string) => {
    const f = (filters ?? []).find((f) => "field" in f && f.field === field);
    return f && "value" in f ? f.value : undefined;
  };
  const handleFilter = (field: string, value: string | undefined) =>
    setFilters([{ field, operator: "eq", value: value || undefined }], "merge");

  return (
    <List
      title="Stock Counts"
      headerButtons={
        can(identity, "stock-counts", "create") ? (
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setModalOpen(true)}>
            New count
          </Button>
        ) : null
      }
    >
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <StoreSelect allowClear value={getFilterValue("storeId")} onChange={(v) => handleFilter("storeId", v)} style={{ width: "100%" }} />
          </Col>
          <Col xs={12} md={5}>
            <Select
              allowClear
              placeholder="Status"
              options={statusOptions}
              value={getFilterValue("status")}
              onChange={(v) => handleFilter("status", v)}
              style={{ width: "100%" }}
            />
          </Col>
        </Row>
      </Card>

      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column
          dataIndex={["subcategory", "name"]}
          title="Aisle"
          render={(v: string, r: any) => <Link to={`/stock-counts/${r.id}`}>{v}</Link>}
        />
        <Table.Column dataIndex={["store", "name"]} title="Store" />
        <Table.Column
          dataIndex="status"
          title="Status"
          render={(s: string) => <Tag color={COUNT_STATUS_CONFIG[s]?.color}>{COUNT_STATUS_CONFIG[s]?.label ?? s}</Tag>}
        />
        <Table.Column dataIndex={["_count", "lines"]} title="Counted" align="right" width={90} />
        <Table.Column dataIndex={["createdBy", "name"]} title="Created by" />
        <Table.Column dataIndex="createdAt" title="Created" render={(v: string) => dayjs(v).format("DD MMM YYYY, HH:mm")} />
        <Table.Column
          dataIndex="submittedAt"
          title="Submitted"
          render={(v?: string) => (v ? dayjs(v).format("DD MMM YYYY, HH:mm") : "—")}
        />
      </Table>
      <NewCountModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </List>
  );
};
