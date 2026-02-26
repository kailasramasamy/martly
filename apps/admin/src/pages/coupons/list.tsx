import { List, useTable, DateField, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Tag, Space, Switch } from "antd";
import { useUpdate } from "@refinedev/core";

export const CouponList = () => {
  const { tableProps } = useTable({ resource: "coupons", syncWithLocation: true });
  const { mutate: update } = useUpdate();

  return (
    <List>
      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column dataIndex="code" title="Code" render={(v: string) => <Tag color="blue">{v}</Tag>} />
        <Table.Column dataIndex="discountType" title="Type" render={(v: string) => <Tag>{v}</Tag>} />
        <Table.Column dataIndex="discountValue" title="Value" render={(v: number, r: any) =>
          r.discountType === "PERCENTAGE" ? `${v}%` : `₹${v}`
        } />
        <Table.Column dataIndex="minOrderAmount" title="Min Order" render={(v: number | null) => v ? `₹${v}` : "—"} />
        <Table.Column dataIndex="usedCount" title="Used" render={(v: number, r: any) =>
          r.usageLimit ? `${v}/${r.usageLimit}` : v
        } />
        <Table.Column dataIndex="expiresAt" title="Expires" render={(v: string | null) =>
          v ? <DateField value={v} format="DD MMM YYYY" /> : "No expiry"
        } />
        <Table.Column dataIndex="isActive" title="Active" render={(v: boolean, r: any) =>
          <Switch size="small" checked={v} onChange={(checked) =>
            update({ resource: "coupons", id: r.id, values: { isActive: checked } })
          } />
        } />
        <Table.Column title="Actions" render={(_, r: any) => (
          <Space>
            <EditButton size="small" recordItemId={r.id} hideText />
            <DeleteButton size="small" recordItemId={r.id} hideText />
          </Space>
        )} />
      </Table>
    </List>
  );
};
