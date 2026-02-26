import { Create, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, DatePicker, Switch, Row, Col, Card } from "antd";
import { DISCOUNT_TYPE_OPTIONS } from "../../constants/tag-colors";

export const CouponCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "coupons", action: "create" });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Code"
              name="code"
              rules={[{ required: true }]}
              normalize={(v: string) => v?.toUpperCase()}
            >
              <Input placeholder="e.g. WELCOME10" style={{ textTransform: "uppercase" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item label="Description" name="description">
              <Input placeholder="Optional description" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Discount Type" name="discountType" rules={[{ required: true }]} initialValue="PERCENTAGE">
              <Select options={DISCOUNT_TYPE_OPTIONS} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Discount Value" name="discountValue" rules={[{ required: true }]} extra="For percentage, enter 10 for 10%">
              <InputNumber min={0.01} step={1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Max Discount Cap" name="maxDiscount" extra="Caps discount for % coupons">
              <InputNumber min={0} style={{ width: "100%" }} prefix="₹" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Min Order Amount" name="minOrderAmount">
              <InputNumber min={0} style={{ width: "100%" }} prefix="₹" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Total Usage Limit" name="usageLimit" extra="Leave empty for unlimited">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Per User Limit" name="perUserLimit" initialValue={1}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Starts At" name="startsAt" extra="Leave empty to start immediately">
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Expires At" name="expiresAt" extra="Leave empty for no expiry">
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Active" name="isActive" valuePropName="checked" initialValue={true}>
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
