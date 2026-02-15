import { List, useTable, EditButton, ShowButton, useSelect } from "@refinedev/antd";
import { Table, Form, Input, Space, Select, Tag } from "antd";
import type { HttpError } from "@refinedev/core";

import { FOOD_TYPE_CONFIG, PRODUCT_TYPE_CONFIG, PRODUCT_TYPE_OPTIONS } from "../../constants/tag-colors";

export const ProductList = () => {
  const { tableProps, searchFormProps } = useTable<
    { id: string; name: string; description: string; brand?: string; foodType?: string; productType?: string; category?: { name: string }; variants?: unknown[] },
    HttpError,
    { q: string; categoryId: string; productType: string }
  >({
    resource: "products",
    onSearch: (values) => [
      { field: "q", operator: "contains", value: values.q },
      { field: "categoryId", operator: "eq", value: values.categoryId },
      { field: "productType", operator: "eq", value: values.productType },
    ],
  });

  const { selectProps: categorySelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <List>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="q" noStyle>
          <Input.Search placeholder="Search products..." allowClear onSearch={searchFormProps.form?.submit} style={{ width: 300 }} />
        </Form.Item>
        <Form.Item name="categoryId" noStyle>
          <Select
            {...categorySelectProps}
            allowClear
            placeholder="Filter by category"
            style={{ width: 200, marginLeft: 8 }}
            onChange={() => searchFormProps.form?.submit()}
          />
        </Form.Item>
        <Form.Item name="productType" noStyle>
          <Select
            options={PRODUCT_TYPE_OPTIONS}
            allowClear
            placeholder="Filter by type"
            style={{ width: 180, marginLeft: 8 }}
            onChange={() => searchFormProps.form?.submit()}
          />
        </Form.Item>
      </Form>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="brand" title="Brand" render={(v: string) => v ?? "—"} />
        <Table.Column
          dataIndex="foodType"
          title="Food Type"
          render={(v: string) => {
            if (!v) return "—";
            const config = FOOD_TYPE_CONFIG[v];
            return config ? <Tag color={config.color}>{config.label}</Tag> : v;
          }}
        />
        <Table.Column
          dataIndex="productType"
          title="Product Type"
          render={(v: string) => {
            if (!v) return "—";
            const config = PRODUCT_TYPE_CONFIG[v];
            return config ? <Tag color={config.color}>{config.label}</Tag> : v;
          }}
        />
        <Table.Column
          title="Category"
          render={(_, record: { category?: { name: string } }) => record.category?.name ?? "—"}
        />
        <Table.Column
          title="Variants"
          render={(_, record: { variants?: unknown[] }) => record.variants?.length ?? 0}
        />
        <Table.Column dataIndex="description" title="Description" />
        <Table.Column
          title="Actions"
          render={(_, record: { id: string }) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <ShowButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
