import { useRef, useState } from "react";
import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Input, Avatar, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import { BrandDrawer, type BrandRecord } from "./brand-drawer";

export const BrandList = () => {
  const { tableProps, searchFormProps } = useTable<BrandRecord, HttpError, { q: string }>({
    resource: "brands",
    sorters: { initial: [{ field: "name", order: "asc" }] },
    onSearch: (values) => [
      { field: "q", operator: "eq", value: values.q },
    ],
  });
  const [selected, setSelected] = useState<BrandRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openBrand = (brand: BrandRecord) => {
    setSelected(brand);
    setDrawerOpen(true);
  };
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = (q: string, delay = 0) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchFormProps.onFinish?.({ q }), delay);
  };

  return (
    <List>
      <div style={{ marginBottom: 16 }}>
        <Input.Search
          placeholder="Search brands..."
          allowClear
          prefix={<SearchOutlined />}
          onSearch={(value) => search(value)}
          onChange={(e) => search(e.target.value, 300)}
          style={{ maxWidth: 360 }}
        />
      </div>
      <Table {...tableProps} rowKey="id">
        <Table.Column
          dataIndex="name"
          title="Name"
          render={(name: string, record: BrandRecord) => (
            <Space style={{ cursor: "pointer" }} onClick={() => openBrand(record)}>
              <Avatar shape="square" src={record.imageUrl} size={32}>{name[0]}</Avatar>
              <Typography.Link>{name}</Typography.Link>
            </Space>
          )}
        />
        <Table.Column dataIndex="slug" title="Slug" />
        <Table.Column title="Products" render={(_, record: BrandRecord) => record._count.products} />
        <Table.Column
          title="Actions"
          render={(_, record: BrandRecord) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
      <BrandDrawer brand={selected} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </List>
  );
};
