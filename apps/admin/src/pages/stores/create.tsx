import { Create, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Form, Input, Select, Card, Row, Col } from "antd";
import { ShopOutlined, EnvironmentOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

interface Identity {
  role: string;
  organizationId?: string;
}

export const StoreCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "stores" });
  const { data: identity } = useGetIdentity<Identity>();

  const isSuperAdmin = identity?.role === "SUPER_ADMIN";

  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    queryOptions: { enabled: isSuperAdmin },
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={
          !isSuperAdmin && identity?.organizationId
            ? { organizationId: identity.organizationId }
            : undefined
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<ShopOutlined />, "Store Details")} size="small">
              {isSuperAdmin ? (
                <Form.Item label="Organization" name="organizationId" rules={[{ required: true }]}>
                  <Select {...orgSelectProps} placeholder="Select organization" />
                </Form.Item>
              ) : (
                <Form.Item name="organizationId" hidden>
                  <Input />
                </Form.Item>
              )}
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<EnvironmentOutlined />, "Contact & Location")} size="small">
              <Form.Item label="Address" name="address" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Phone" name="phone">
                <Input />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
