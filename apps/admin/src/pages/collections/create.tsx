import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Switch, Card, Row, Col } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";

export const CollectionCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "collections" });

  const { selectProps: productSelectProps } = useSelect({
    resource: "products",
    optionLabel: "name",
    optionValue: "id",
  });

  const onTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    formProps.form?.setFieldsValue({ slug });
  };

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical" initialValues={{ isActive: true, sortOrder: 0 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Collection Details")} size="small">
              <Form.Item label="Title" name="title" rules={[{ required: true }]}>
                <Input onChange={onTitleChange} />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Subtitle" name="subtitle">
                <Input />
              </Form.Item>
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item label="Sort Order" name="sortOrder">
                    <InputNumber min={0} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Products & Image")} size="small">
              <Form.Item label="Products" name="productIds">
                <Select
                  {...productSelectProps}
                  mode="multiple"
                  placeholder="Select products for this collection"
                  allowClear
                />
              </Form.Item>
              <Form.Item
                label="Cover Image"
                name="imageUrl"
                getValueFromEvent={(url: string) => url}
              >
                <ImageUpload />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
