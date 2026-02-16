import { Create, useForm, useSelect } from "@refinedev/antd";
import { Form, Select, InputNumber, Card, Row, Col, DatePicker } from "antd";
import { LinkOutlined, DollarOutlined, TagOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";
import { DISCOUNT_TYPE_OPTIONS } from "../../constants/tag-colors";

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

  const discountType = Form.useWatch("discountType", formProps.form);

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

          <Col xs={24}>
            <Card title={sectionTitle(<TagOutlined />, "Discount")} size="small">
              <Row gutter={16}>
                <Col xs={24} sm={12}>
                  <Form.Item label="Discount Type" name="discountType">
                    <Select options={DISCOUNT_TYPE_OPTIONS} allowClear placeholder="No discount" />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Discount Value" name="discountValue">
                    <InputNumber
                      min={0}
                      step={discountType === "PERCENTAGE" ? 1 : 0.01}
                      max={discountType === "PERCENTAGE" ? 100 : undefined}
                      style={{ width: "100%" }}
                      placeholder={discountType === "PERCENTAGE" ? "e.g. 10" : "e.g. 15.00"}
                      addonAfter={discountType === "PERCENTAGE" ? "%" : "₹"}
                    />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="Start Date" name="discountStart">
                    <DatePicker showTime style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={24} sm={12}>
                  <Form.Item label="End Date" name="discountEnd">
                    <DatePicker showTime style={{ width: "100%" }} />
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
