import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Card, Row, Col } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

export const CategoryCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "categories" });

  const { selectProps: parentSelectProps } = useSelect({
    resource: "categories",
    optionLabel: "name",
    optionValue: "id",
  });

  const onNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    formProps.form?.setFieldsValue({ slug });
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Category Details")} size="small">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                    <Input onChange={onNameChange} />
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
                  <Form.Item label="Sort Order" name="sortOrder" initialValue={0}>
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
    </Create>
  );
};
