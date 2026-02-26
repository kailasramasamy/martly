import { List, useTable, ShowButton } from "@refinedev/antd";
import { Table, Input, Avatar, Space, Typography, Card, Row, Col, Statistic, Tag } from "antd";
import { UserOutlined, SearchOutlined, ShoppingCartOutlined, TeamOutlined } from "@ant-design/icons";
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
  const { tableProps, searchFormProps, tableQuery } = useTable<
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

  const allCustomers = (tableQuery?.data?.data ?? []) as unknown as CustomerRecord[];
  const totalCustomers = tableQuery?.data?.total ?? allCustomers.length;
  const thisMonth = dayjs().startOf("month");
  const newThisMonth = allCustomers.filter((c) => dayjs(c.createdAt).isAfter(thisMonth)).length;
  const withOrders = allCustomers.filter((c) => (c._count?.orders ?? 0) > 0).length;

  return (
    <List canCreate={false}>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="Total Customers"
              value={totalCustomers}
              prefix={<TeamOutlined style={{ color: BRAND.primary }} />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="New This Month"
              value={newThisMonth}
              prefix={<UserOutlined style={{ color: BRAND.success }} />}
            />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic
              title="With Orders"
              value={withOrders}
              prefix={<ShoppingCartOutlined style={{ color: BRAND.info }} />}
            />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Input
          placeholder="Search by name or email..."
          prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
          allowClear
          onChange={(e) => {
            const form = searchFormProps.form;
            form?.setFieldsValue({ q: e.target.value });
            form?.submit();
          }}
          style={{ maxWidth: 400 }}
        />
      </Card>

      <Table {...tableProps} rowKey="id" size="small">
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
                <div style={{ fontWeight: 500 }}>{record.name}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>{record.email}</div>
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
          render={(_, record: CustomerRecord) => {
            const count = record._count?.orders ?? 0;
            return count > 0
              ? <Tag color="blue">{count}</Tag>
              : <Text type="secondary">0</Text>;
          }}
        />
        <Table.Column
          dataIndex="createdAt"
          title="Joined"
          width={140}
          render={(value: string) => dayjs(value).format("DD MMM YYYY")}
          sorter
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
