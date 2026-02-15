import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Select, InputNumber, Card, Row, Col } from "antd";
import { LinkOutlined, DollarOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

export const StoreProductCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "store-products" });

  const { selectProps: storeSelectProps } = useSelect({
    resource: "stores",
    optionLabel: "name",
    optionValue: "id",
  });

  const { selectProps: productSelectProps } = useSelect({
    resource: "products",
    optionLabel: "name",
    optionValue: "id",
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<LinkOutlined />, "Assignment")} size="small">
              <Form.Item label="Store" name="storeId" rules={[{ required: true }]}>
                <Select {...storeSelectProps} placeholder="Select a store" />
              </Form.Item>
              <Form.Item label="Product" name="productId" rules={[{ required: true }]}>
                <Select {...productSelectProps} placeholder="Select a product" />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<DollarOutlined />, "Pricing & Stock")} size="small">
              <Form.Item label="Price" name="price" rules={[{ required: true }]}>
                <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item label="Stock" name="stock" rules={[{ required: true }]}>
                <InputNumber min={0} step={1} style={{ width: "100%" }} />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
