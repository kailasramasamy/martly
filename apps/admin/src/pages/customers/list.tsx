import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Form, Input, Avatar, Space, Typography } from "antd";
import { UserOutlined } from "@ant-design/icons";
import type { HttpError } from "@refinedev/core";
import dayjs from "dayjs";
import { BRAND } from "../../theme";

const { Text } = Typography;

interface CustomerRecord {
  id: string;
  name: string;
  email: string;
  phone?: string;
  createdAt: string;
  _count?: { orders: number };
}

export const CustomerList = () => {
  const { tableProps, searchFormProps } = useTable<
    CustomerRecord,
    HttpError,
    { q: string }
  >({
    resource: "users",
    filters: {
      permanent: [{ field: "role", operator: "eq", value: "CUSTOMER" }],
    },
    onSearch: (values) => [
      { field: "q", operator: "contains", value: values.q },
    ],
  });

  return (
    <List canCreate={false}>
      <Form {...searchFormProps} layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item name="q" noStyle>
          <Input.Search
            placeholder="Search by name or email..."
            allowClear
            onSearch={searchFormProps.form?.submit}
            style={{ width: 300 }}
          />
        </Form.Item>
      </Form>
      <Table {...tableProps} rowKey="id">
        <Table.Column
          title="Customer"
          render={(_, record: CustomerRecord) => (
            <Space>
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ backgroundColor: BRAND.primary }}
              />
              <div>
                <Text strong>{record.name}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.email}
                </Text>
              </div>
            </Space>
          )}
        />
        <Table.Column
          dataIndex="phone"
          title="Phone"
          width={150}
          render={(v) => v || <Text type="secondary">—</Text>}
        />
        <Table.Column
          title="Orders"
          width={90}
          align="center"
          render={(_, record: CustomerRecord) => (
            <Text strong>{record._count?.orders ?? 0}</Text>
          )}
        />
        <Table.Column
          dataIndex="createdAt"
          title="Joined"
          width={140}
          render={(value: string) => dayjs(value).format("DD MMM YYYY")}
        />
        <Table.Column
          title=""
          width={50}
          render={(_, record: CustomerRecord) => (
            <ShowButton
              hideText
              size="small"
              recordItemId={record.id}
              resource="customers"
            />
          )}
        />
      </Table>
    </List>
  );
};
