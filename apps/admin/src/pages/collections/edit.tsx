import { Edit, useForm, useSelect } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Switch, Card, Row, Col } from "antd";
import { AppstoreOutlined } from "@ant-design/icons";
import { ImageUpload } from "../../components/ImageUpload";
import { sectionTitle } from "../../theme";

export const CollectionEdit = () => {
  const { formProps, saveButtonProps, queryResult } = useForm({
    resource: "collections",
  });

  const { selectProps: productSelectProps } = useSelect({
    resource: "products",
    optionLabel: "name",
    optionValue: "id",
  });

  // Transform initial data: items → productIds
  const record = queryResult?.data?.data as any;
  const initialProductIds = record?.items?.map((item: any) => item.product?.id ?? item.productId) ?? [];

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={{
          ...formProps.initialValues,
          productIds: initialProductIds,
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<AppstoreOutlined />, "Collection Details")} size="small">
              <Form.Item label="Title" name="title" rules={[{ required: true }]}>
                <Input />
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
    </Edit>
  );
};
