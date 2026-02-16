import { List, useTable, EditButton, DeleteButton, useSelect } from "@refinedev/antd";
import { Table, Tag, Form, Input, Space, Typography, Tooltip, Select, Badge } from "antd";
import type { HttpError } from "@refinedev/core";

import { ACTIVE_STATUS_CONFIG } from "../../constants/tag-colors";

const { Text } = Typography;

interface Pricing {
  effectivePrice: number;
  originalPrice: number;
  discountType: string | null;
  discountValue: number | null;
  discountActive: boolean;
  savingsAmount: number;
  savingsPercent: number;
}

interface StoreProductRecord {
  id: string;
  store: { name: string };
  product: { name: string; imageUrl?: string; brand?: { name: string } };
  variant: { name: string; unitType?: string; unitValue?: number };
  price: number;
  stock: number;
  reservedStock: number;
  availableStock: number;
  isActive: boolean;
  pricing?: Pricing;
}

function stockTag(available: number, total: number) {
  if (total === 0) return <Tag color="default">Not tracked</Tag>;
  if (available <= 0) return <Tag color="red">Out of stock</Tag>;
  if (available <= 5) return <Tag color="orange">Low stock</Tag>;
  return <Tag color="green">In stock</Tag>;
}

export const StoreProductList = () => {
  const { tableProps, searchFormProps } = useTable<
    StoreProductRecord,
    HttpError,
    { q: string; storeId: string }
  >({
    resource: "store-products",
    onSearch: (values) => [
      { field: "q", operator: "contains", value: values.q },
      { field: "storeId", operator: "eq", value: values.storeId },
    ],
  });

  const { selectProps: storeSelectProps } = useSelect({
    resource: "stores",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <List>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16, gap: 8, display: "flex", flexWrap: "wrap" }}>
        <Form.Item name="q" noStyle>
          <Input.Search placeholder="Search store products..." allowClear onSearch={searchFormProps.form?.submit} style={{ width: 280 }} />
        </Form.Item>
        <Form.Item name="storeId" noStyle>
          <Select
            {...storeSelectProps}
            allowClear
            placeholder="Store"
            style={{ width: 180 }}
            onChange={() => searchFormProps.form?.submit()}
          />
        </Form.Item>
      </Form>

      <Table<StoreProductRecord> {...tableProps} rowKey="id" size="middle">
        <Table.Column
          title=""
          width={48}
          render={(_, record: StoreProductRecord) => (
            <img
              src={record.product?.imageUrl || "https://placehold.co/36x36/f0f0f0/999?text=—"}
              alt=""
              style={{ width: 36, height: 36, borderRadius: 4, objectFit: "cover", display: "block" }}
            />
          )}
        />

        <Table.Column
          title="Product"
          render={(_, record: StoreProductRecord) => (
            <div>
              <Text strong style={{ fontSize: 13 }}>{record.product?.name}</Text>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                {record.product?.brand?.name && (
                  <Text type="secondary" style={{ fontSize: 12 }}>{record.product.brand.name}</Text>
                )}
                {record.product?.brand?.name && record.variant?.name && (
                  <Text type="secondary" style={{ fontSize: 12 }}>·</Text>
                )}
                {record.variant?.name && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {record.variant.name}
                    {record.variant.unitValue != null && record.variant.unitType
                      ? ` (${Number(record.variant.unitValue)} ${record.variant.unitType})`
                      : ""}
                  </Text>
                )}
              </div>
            </div>
          )}
        />

        <Table.Column
          title="Store"
          width={160}
          render={(_, record: StoreProductRecord) => (
            <Tag>{record.store?.name}</Tag>
          )}
        />

        <Table.Column
          title="Price"
          width={130}
          render={(_, record: StoreProductRecord) => {
            if (record.pricing?.discountActive) {
              return (
                <div>
                  <Text delete type="secondary" style={{ fontSize: 12 }}>
                    ₹{Number(record.pricing.originalPrice).toFixed(2)}
                  </Text>
                  <br />
                  <Text strong>₹{Number(record.pricing.effectivePrice).toFixed(2)}</Text>
                </div>
              );
            }
            return <Text>₹{Number(record.price).toFixed(2)}</Text>;
          }}
        />

        <Table.Column
          title="Discount"
          width={130}
          render={(_, record: StoreProductRecord) => {
            if (!record.pricing?.discountActive) return <Text type="secondary">—</Text>;
            const { discountType, discountValue } = record.pricing;
            const label = discountType === "PERCENTAGE"
              ? `${discountValue}% OFF`
              : `₹${discountValue} OFF`;
            return (
              <Badge status="processing" color="red" text={
                <Text style={{ fontSize: 12 }}>{label}</Text>
              } />
            );
          }}
        />

        <Table.Column
          title="Stock"
          width={170}
          render={(_, record: StoreProductRecord) => {
            const total = record.stock ?? 0;
            const reserved = record.reservedStock ?? 0;
            const available = record.availableStock ?? (total - reserved);
            return (
              <Tooltip title={`Total: ${total} · Reserved: ${reserved} · Available: ${available}`}>
                <div>
                  <Space size={4} align="center">
                    {stockTag(available, total)}
                    <Text strong>{available}</Text>
                    <Text type="secondary" style={{ fontSize: 12 }}>/ {total}</Text>
                  </Space>
                  {reserved > 0 && (
                    <div>
                      <Text type="secondary" style={{ fontSize: 11 }}>{reserved} reserved</Text>
                    </div>
                  )}
                </div>
              </Tooltip>
            );
          }}
        />

        <Table.Column
          title="Active"
          width={80}
          dataIndex="isActive"
          render={(value) => {
            const config = ACTIVE_STATUS_CONFIG[String(value)];
            return <Tag color={config?.color ?? "default"}>{config?.label ?? String(value)}</Tag>;
          }}
        />

        <Table.Column
          title=""
          width={80}
          render={(_, record: StoreProductRecord) => (
            <Space size={4}>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
