import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { Table, Tag, Space, Switch } from "antd";
import { useUpdate } from "@refinedev/core";

export const DeliveryZoneList = () => {
  const { tableProps } = useTable({ resource: "delivery-zones", syncWithLocation: true });
  const { mutate: update } = useUpdate();

  return (
    <List>
      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column dataIndex="name" title="Zone Name" />
        <Table.Column dataIndex="pincodes" title="Pincodes" render={(v: string[]) =>
          v?.length ? v.map((p) => <Tag key={p}>{p}</Tag>) : "—"
        } />
        <Table.Column dataIndex="deliveryFee" title="Fee" render={(v: number) => `₹${v}`} />
        <Table.Column dataIndex="estimatedMinutes" title="Est. Time" render={(v: number) => `${v} min`} />
        <Table.Column dataIndex="stores" title="Stores" render={(v: any[]) =>
          v?.map((s: any) => <Tag key={s.store?.id}>{s.store?.name}</Tag>) ?? "—"
        } />
        <Table.Column dataIndex="isActive" title="Active" render={(v: boolean, r: any) =>
          <Switch size="small" checked={v} onChange={(checked) =>
            update({ resource: "delivery-zones", id: r.id, values: { isActive: checked } })
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
