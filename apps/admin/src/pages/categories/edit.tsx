import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Card, Row, Col } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

export const CategoryEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "categories" });

  const { selectProps: parentSelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Category Details")} size="small">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Parent Category" name="parentId">
                    <Select {...parentSelectProps} allowClear placeholder="None (top-level)" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Sort Order" name="sortOrder">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Image URL" name="imageUrl">
                    <Input />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
