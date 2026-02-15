import { Edit, useForm } from "@refinedev/antd";
import { Form, InputNumber, Switch, Card, Row, Col, Descriptions } from "antd";
import { InfoCircleOutlined, DollarOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

export const StoreProductEdit = () => {
  const { formProps, saveButtonProps, query } = useForm({
    resource: "store-products",
  });

  const record = query?.data?.data as { store?: { name: string }; product?: { name: string } } | undefined;

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          {(record?.store || record?.product) && (
            <Col xs={24}>
              <Card title={sectionTitle(<InfoCircleOutlined />, "Product Info")} size="small" style={{ marginBottom: 16 }}>
                <Descriptions column={{ xs: 1, sm: 2 }} size="small" bordered>
                  {record?.store && (
                    <Descriptions.Item label="Store">{record.store.name}</Descriptions.Item>
                  )}
                  {record?.product && (
                    <Descriptions.Item label="Product">{record.product.name}</Descriptions.Item>
                  )}
                </Descriptions>
              </Card>
            </Col>
          )}

          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<DollarOutlined />, "Pricing & Stock")} size="small">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Price" name="price" rules={[{ required: true }]}>
                    <InputNumber min={0.01} step={0.01} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Stock" name="stock" rules={[{ required: true }]}>
                    <InputNumber min={0} step={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24}>
                  <Form.Item label="Active" name="isActive" valuePropName="checked">
                    <Switch />
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
