import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, Select, Card, Row, Col } from "antd";
import { ShopOutlined, EnvironmentOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

export const StoreCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "stores" });

  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<ShopOutlined />, "Store Details")} size="small">
              <Form.Item label="Organization" name="organizationId" rules={[{ required: true }]}>
                <Select {...orgSelectProps} placeholder="Select organization" />
              </Form.Item>
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
