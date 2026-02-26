---
globs: apps/admin/**
---

# Admin Panel Conventions (React 19 + Refine + Ant Design 5)

## Framework Stack

- **Refine** for data fetching hooks (`useTable`, `useForm`, `useShow`, `useList`, `useDelete`)
- **Ant Design 5** for UI components
- **React Router 7** for routing (via `@refinedev/react-router`)
- **Theme**: Teal/emerald brand (`#0d9488`), dark mode via `localStorage` key `martly_theme`

## Data Fetching

### Option 1: Refine hooks (for standard CRUD pages)
```ts
import { List, useTable, ShowButton, EditButton } from "@refinedev/antd";

const { tableProps, setFilters, filters } = useTable({
  resource: "orders",
  syncWithLocation: true,
});
```

### Option 2: axiosInstance (for custom/non-CRUD pages)
```ts
import { axiosInstance } from "../../providers/data-provider";

const res = await axiosInstance.get("/loyalty/config");
const data = res?.data?.data; // API wraps in { success, data }
```

The data provider at `providers/data-provider.ts` auto-attaches Bearer token from `localStorage` key `martly_admin_token`.

## Resource Registration

In `App.tsx`, resources are registered with route paths and sidebar metadata:
```tsx
{
  name: "resource-name",
  list: "/resource-name",
  create: "/resource-name/create",
  edit: "/resource-name/edit/:id",
  show: "/resource-name/show/:id",
  meta: { label: "Display Name", icon: <SomeOutlined />, parent: "group-name" },
}
```

Then add corresponding `<Route>` elements in the Routes block.

## Access Control

In `providers/access-control.ts`, add permission checks per resource:
```ts
if (resource === "resource-name") {
  if (role === "ORG_ADMIN") return { can: true };
  return { can: false, reason: "Only Super Admin or Org Admin can manage this" };
}
```

## Page Patterns

### List page (with table + filters)
```tsx
export const ResourceList = () => {
  const { tableProps, setFilters, filters } = useTable({ resource: "resource" });
  return (
    <List>
      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column title="Actions" render={(_, rec) => (
          <Space>
            <ShowButton hideText size="small" recordItemId={rec.id} />
            <EditButton hideText size="small" recordItemId={rec.id} />
          </Space>
        )} />
      </Table>
    </List>
  );
};
```

### Form page (create/edit)
```tsx
export const ResourceCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "resource" });
  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Form.Item name="field" label="Label" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
      </Form>
    </Create>
  );
};
```

### Custom page (settings/config)
Use `axiosInstance` directly with `Form.useForm()`, manual loading/saving state.

## Tag Colors

Status tags use configs from `constants/tag-colors.ts`:
```ts
import { ORDER_STATUS_CONFIG } from "../../constants/tag-colors";
const cfg = ORDER_STATUS_CONFIG[status];
<Tag color={cfg.color}>{cfg.label}</Tag>
```

## Navigation

- No separate "Store Products" sidebar — Products page has tabs: All Products, Mapped Products, Store Products, Master Catalog
- Sidebar groups: Inventory, Marketing, Delivery (using `parent` in resource meta)
- Icons from `@ant-design/icons`
