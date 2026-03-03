import { List, useTable, EditButton, DeleteButton } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Table, Tag, Form, Input, Select, Space, Typography } from "antd";
import type { HttpError } from "@refinedev/core";

const { Text } = Typography;

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: "red",
  ORG_ADMIN: "blue",
  STORE_MANAGER: "green",
  STAFF: "orange",
  RIDER: "cyan",
  CUSTOMER: "default",
};

const ROLE_OPTIONS = [
  { label: "All Roles", value: "" },
  { label: "Super Admin", value: "SUPER_ADMIN" },
  { label: "Org Admin", value: "ORG_ADMIN" },
  { label: "Store Manager", value: "STORE_MANAGER" },
  { label: "Staff", value: "STAFF" },
  { label: "Rider", value: "RIDER" },
  { label: "Customer", value: "CUSTOMER" },
];

const ORG_ROLE_OPTIONS = [
  { label: "All Roles", value: "" },
  { label: "Store Manager", value: "STORE_MANAGER" },
  { label: "Staff", value: "STAFF" },
  { label: "Rider", value: "RIDER" },
  { label: "Customer", value: "CUSTOMER" },
];

interface StoreInfo {
  store: { id: string; name: string; organization: { id: string; name: string } };
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  userStores?: StoreInfo[];
}

interface Identity {
  role: string;
}

function getOrgNames(record: UserRecord): string[] {
  if (!record.userStores?.length) return [];
  const seen = new Set<string>();
  const names: string[] = [];
  for (const us of record.userStores) {
    const org = us.store.organization;
    if (!seen.has(org.id)) {
      seen.add(org.id);
      names.push(org.name);
    }
  }
  return names;
}

function getStoreNames(record: UserRecord): string[] {
  if (!record.userStores?.length) return [];
  return record.userStores.map((us) => us.store.name);
}

export const UserList = () => {
  const { data: identity } = useGetIdentity<Identity>();
  const isSuperAdmin = identity?.role === "SUPER_ADMIN";
  const roleOptions = isSuperAdmin ? ROLE_OPTIONS : ORG_ROLE_OPTIONS;

  const { tableProps, searchFormProps } = useTable<
    UserRecord,
    HttpError,
    { q: string; role: string }
  >({
    resource: "users",
    onSearch: (values) => [
      { field: "q", operator: "contains", value: values.q },
      { field: "role", operator: "eq", value: values.role },
    ],
  });

  return (
    <List>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16, gap: 8 }}>
        <Form.Item name="q" noStyle>
          <Input.Search placeholder="Search users..." allowClear onSearch={searchFormProps.form?.submit} style={{ width: 300 }} />
        </Form.Item>
        <Form.Item name="role" noStyle>
          <Select
            placeholder="Filter by role"
            allowClear
            options={roleOptions}
            onChange={searchFormProps.form?.submit}
            style={{ width: 180 }}
          />
        </Form.Item>
      </Form>
      <Table {...tableProps} rowKey="id" size="small">
        <Table.Column dataIndex="name" title="Name" />
        <Table.Column dataIndex="email" title="Email" />
        <Table.Column
          dataIndex="role"
          title="Role"
          width={140}
          render={(value: string) => (
            <Tag color={ROLE_COLORS[value] ?? "default"}>
              {value.replace(/_/g, " ")}
            </Tag>
          )}
        />
        <Table.Column
          title="Organization"
          width={180}
          render={(_, record: UserRecord) => {
            if (record.role === "SUPER_ADMIN") return <Tag color="red">All</Tag>;
            const orgs = getOrgNames(record);
            if (orgs.length === 0) return <Text type="secondary">—</Text>;
            return (
              <Space size={4} wrap>
                {orgs.map((name) => (
                  <Tag key={name} color="blue">{name}</Tag>
                ))}
              </Space>
            );
          }}
        />
        <Table.Column
          title="Stores"
          render={(_, record: UserRecord) => {
            if (record.role === "SUPER_ADMIN") return <Tag color="red">All</Tag>;
            const stores = getStoreNames(record);
            if (stores.length === 0) return <Text type="secondary">—</Text>;
            return (
              <Space size={4} wrap>
                {stores.map((name) => (
                  <Tag key={name}>{name}</Tag>
                ))}
              </Space>
            );
          }}
        />
        <Table.Column
          title="Actions"
          width={80}
          render={(_, record: UserRecord) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              <DeleteButton hideText size="small" recordItemId={record.id} />
            </Space>
          )}
        />
      </Table>
    </List>
  );
};
