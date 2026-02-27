---
name: new-admin-page
description: Scaffold a new admin panel page for the Martly admin app using Refine + Ant Design patterns
argument-hint: <resource-name>
---

Create a new admin panel page for the Martly admin app.

**Resource name:** $ARGUMENTS

## Steps

1. **Read existing pages for reference** — Read files in `/Users/vaidehi/Projects/martly/apps/admin/src/pages/products/` to understand the established Refine + Ant Design patterns.

2. **Create page directory** at `apps/admin/src/pages/<resource-name>/` with these files:
   - `list.tsx` — List page with table
   - `show.tsx` — Detail/show page (if needed)
   - `edit.tsx` — Edit/create form (if needed)

3. **Follow these conventions:**
   - Use `useTable` from `@refinedev/antd` for list pages
   - Use `useShow` from `@refinedev/antd` for show pages
   - Use `useForm` from `@refinedev/antd` for edit/create pages
   - Use Ant Design components: `Table`, `Form`, `Input`, `Select`, `Card`, `Space`, `Tag`, etc.
   - Apply the project's teal/emerald brand theme tokens
   - Wrap pages in `<List>`, `<Show>`, or `<Edit>` Refine layout components
   - Add proper `<Table.Column>` definitions with sorters and filters where appropriate

4. **Register the resource** in `apps/admin/src/App.tsx`:
   - Import the page components
   - Add a new `<Route>` entry in the router setup
   - Add the resource to the Refine `resources` array with `list`, `show`, `edit`, and `create` actions
   - Add a sidebar menu item with an appropriate Ant Design icon

5. **Add API data provider mapping** — Ensure the resource name maps correctly to the API endpoint (e.g., resource `featured-products` maps to `/api/v1/featured-products`).

## Pattern Reference

```tsx
// list.tsx
import { List, useTable, EditButton, ShowButton } from "@refinedev/antd";
import { Table, Space, Tag } from "antd";

export const ResourceList = () => {
  const { tableProps } = useTable({ syncWithLocation: true });

  return (
    <List>
      <Table {...tableProps} rowKey="id">
        <Table.Column dataIndex="name" title="Name" sorter />
        <Table.Column dataIndex="status" title="Status"
          render={(value) => <Tag color={value === "ACTIVE" ? "green" : "default"}>{value}</Tag>}
        />
        <Table.Column title="Actions"
          render={(_, record) => (
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
```
