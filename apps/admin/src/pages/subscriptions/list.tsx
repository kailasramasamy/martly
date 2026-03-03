import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Tag, Select, Card, Row, Col } from "antd";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { SUBSCRIPTION_STATUS_CONFIG, SUBSCRIPTION_FREQUENCY_CONFIG } from "../../constants/tag-colors";

const statusOptions = Object.entries(SUBSCRIPTION_STATUS_CONFIG).map(([value, { label }]) => ({ label, value }));
const frequencyOptions = Object.entries(SUBSCRIPTION_FREQUENCY_CONFIG).map(([value, { label }]) => ({ label, value }));

interface Store {
  id: string;
  name: string;
}

export const SubscriptionList = () => {
  const [stores, setStores] = useState<Store[]>([]);

  const { tableProps, setFilters, filters } = useTable({
    resource: "subscriptions/admin",
    syncWithLocation: true,
  });

  useEffect(() => {
    axiosInstance.get("/stores?pageSize=100").then((res) => {
      setStores(res?.data?.data ?? []);
    });
  }, []);

  const currentFilters = filters ?? [];
  const getFilterValue = (field: string) => {
    const f = currentFilters.find((f) => "field" in f && f.field === field);
    return f && "value" in f ? f.value : undefined;
  };

  const handleFilter = (field: string, value: string | undefined) => {
    setFilters([{ field, operator: "eq", value: value || undefined }], "merge");
  };

  return (
    <List>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={8}>
            <Select
              placeholder="Store"
              options={stores.map((s) => ({ label: s.name, value: s.id }))}
              value={getFilterValue("storeId")}
              onChange={(v) => handleFilter("storeId", v)}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={12} md={8}>
            <Select
              placeholder="Status"
              options={statusOptions}
              value={getFilterValue("status")}
              onChange={(v) => handleFilter("status", v)}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>
          <Col xs={12} md={8}>
            <Select
              placeholder="Frequency"
              options={frequencyOptions}
              value={getFilterValue("frequency")}
              onChange={(v) => handleFilter("frequency", v)}
              allowClear
              style={{ width: "100%" }}
            />
          </Col>
        </Row>
      </Card>

      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column
          dataIndex={["user", "name"]}
          title="Customer"
          render={(name: string, record: any) => (
            <div>
              <div style={{ fontWeight: 500 }}>{name ?? "\u2014"}</div>
              {record.user?.phone && (
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{record.user.phone}</div>
              )}
            </div>
          )}
        />
        <Table.Column
          dataIndex={["store", "name"]}
          title="Store"
          render={(name: string) => name ?? "\u2014"}
        />
        <Table.Column
          dataIndex="frequency"
          title="Frequency"
          width={140}
          render={(value: string) => {
            const config = SUBSCRIPTION_FREQUENCY_CONFIG[value];
            return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
          }}
        />
        <Table.Column
          dataIndex="items"
          title="Items"
          width={260}
          render={(items: any[]) =>
            items?.length > 0 ? (
              <div style={{ fontSize: 13, lineHeight: "20px" }}>
                {items.map((item: any, i: number) => {
                  const name = item.storeProduct?.product?.name ?? "—";
                  const variantName = item.storeProduct?.variant?.name ?? "";
                  return (
                    <div key={i} style={{ whiteSpace: "nowrap" }}>
                      {item.quantity}x {name}{variantName ? ` (${variantName})` : ""}
                    </div>
                  );
                })}
              </div>
            ) : (
              <span style={{ color: "#94a3b8" }}>—</span>
            )
          }
        />
        <Table.Column
          dataIndex="status"
          title="Status"
          width={100}
          render={(value: string) => {
            const config = SUBSCRIPTION_STATUS_CONFIG[value];
            return <Tag color={config?.color ?? "default"}>{config?.label ?? value}</Tag>;
          }}
        />
        <Table.Column
          dataIndex="nextDeliveryDate"
          title="Next Delivery"
          width={130}
          render={(v: string) => v ? dayjs(v).format("DD MMM YYYY") : "\u2014"}
        />
        <Table.Column
          dataIndex="createdAt"
          title="Created"
          width={160}
          render={(v: string) =>
            v ? new Date(v).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "\u2014"
          }
          sorter
        />
        <Table.Column
          title=""
          width={50}
          render={(_, record: { id: string }) => (
            <ShowButton hideText size="small" recordItemId={record.id} resource="subscriptions" />
          )}
        />
      </Table>
    </List>
  );
};
