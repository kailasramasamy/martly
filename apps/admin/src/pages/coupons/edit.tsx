import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, DatePicker, Switch, Row, Col } from "antd";
import dayjs from "dayjs";
import { DISCOUNT_TYPE_OPTIONS } from "../../constants/tag-colors";

export const CouponEdit = () => {
  const { formProps, saveButtonProps, queryResult } = useForm({ resource: "coupons", action: "edit" });
  const record = queryResult?.data?.data;

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical"
        initialValues={{
          ...record,
          startsAt: record?.startsAt ? dayjs(record.startsAt) : null,
          expiresAt: record?.expiresAt ? dayjs(record.expiresAt) : null,
        }}
      >
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item
              label="Code"
              name="code"
              rules={[{ required: true }]}
              normalize={(v: string) => v?.toUpperCase()}
            >
              <Input style={{ textTransform: "uppercase" }} />
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
            <Form.Item label="Discount Type" name="discountType" rules={[{ required: true }]}>
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
            <Form.Item label="Per User Limit" name="perUserLimit">
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={8}>
            <Form.Item label="Starts At" name="startsAt">
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Expires At" name="expiresAt">
              <DatePicker showTime style={{ width: "100%" }} />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item label="Active" name="isActive" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Col>
        </Row>
      </Form>
    </Edit>
  );
};
