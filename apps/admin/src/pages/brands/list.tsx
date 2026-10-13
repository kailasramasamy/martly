import { useState } from "react";
import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Space, Avatar, Typography } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import { BrandDrawer, type BrandRecord } from "./brand-drawer";
import { DebouncedSearch } from "../../components/DebouncedSearch";

export const BrandList = () => {
  const { tableProps, searchFormProps } = useTable<BrandRecord, HttpError, { q: string }>({
    resource: "brands",
    sorters: { initial: [{ field: "name", order: "asc" }] },
    pagination: { pageSize: 25 },
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

  return (
    <List>
      <div style={{ marginBottom: 16 }}>
        <DebouncedSearch
          placeholder="Search brands..."
          prefix={<SearchOutlined />}
          onSearch={(q) => searchFormProps.onFinish?.({ q })}
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
