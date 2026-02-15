import { Create, useForm } from "@refinedev/antd";
import { Form, Input, Card, Row, Col } from "antd";
import { BankOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

export const OrganizationCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "organizations" });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<BankOutlined />, "Organization Details")} size="small">
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true, pattern: /^[a-z0-9-]+$/, message: "Lowercase letters, numbers, and hyphens only" }]}>
                <Input />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
