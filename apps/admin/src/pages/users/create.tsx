import { Create, useForm } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Form, Input, Select, Card, Row, Col } from "antd";
import { UserOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

interface Identity {
  role: string;
}

const ALL_ROLES = [
  { label: "Super Admin", value: "SUPER_ADMIN" },
  { label: "Org Admin", value: "ORG_ADMIN" },
  { label: "Store Manager", value: "STORE_MANAGER" },
  { label: "Staff", value: "STAFF" },
];

const ORG_ROLES = [
  { label: "Store Manager", value: "STORE_MANAGER" },
  { label: "Staff", value: "STAFF" },
];

export const UserCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "users" });
  const { data: identity } = useGetIdentity<Identity>();

  const isSuperAdmin = identity?.role === "SUPER_ADMIN";
  const roleOptions = isSuperAdmin ? ALL_ROLES : ORG_ROLES;

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<UserOutlined />, "User Details")} size="small">
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Email" name="email" rules={[{ required: true, type: "email" }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Password" name="password" rules={[{ required: true, min: 8 }]}>
                <Input.Password />
              </Form.Item>
              <Form.Item label="Phone" name="phone">
                <Input />
              </Form.Item>
              <Form.Item label="Role" name="role" rules={[{ required: true }]}>
                <Select options={roleOptions} placeholder="Select role" />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
