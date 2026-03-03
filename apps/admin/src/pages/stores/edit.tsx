import { Edit, useForm } from "@refinedev/antd";
import { Form, Input, InputNumber, Select, Card, Row, Col, Slider, Switch, Radio } from "antd";
import { ShopOutlined, EnvironmentOutlined, ShoppingCartOutlined, CalendarOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

export const StoreEdit = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "stores" });

  return (
    <Edit saveButtonProps={saveButtonProps}>
      <Form {...formProps} layout="vertical">
        <Row gutter={[16, 16]}>
          {/* Left column: General info */}
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<ShopOutlined />, "Store Details")} size="small">
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Status" name="status" rules={[{ required: true }]}>
                <Select
                  options={[
                    { label: "Pending", value: "PENDING" },
                    { label: "Active", value: "ACTIVE" },
                    { label: "Suspended", value: "SUSPENDED" },
                    { label: "Closed", value: "CLOSED" },
                  ]}
                />
              </Form.Item>
            </Card>

            <Card title={sectionTitle(<EnvironmentOutlined />, "Contact & Location")} size="small" style={{ marginTop: 16 }}>
              <Form.Item label="Address" name="address" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Phone" name="phone">
                <Input />
              </Form.Item>
              <Row gutter={12}>
                <Col span={12}>
                  <Form.Item label="Latitude" name="latitude">
                    <InputNumber style={{ width: "100%" }} step={0.0001} placeholder="e.g. 19.0760" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item label="Longitude" name="longitude">
                    <InputNumber style={{ width: "100%" }} step={0.0001} placeholder="e.g. 72.8777" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>
          </Col>

          {/* Right column: Operational settings */}
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<ShoppingCartOutlined />, "Delivery Settings")} size="small">
              <Form.Item label="Delivery Radius (km)" name="deliveryRadius">
                <Slider min={1} max={25} step={0.5} marks={{ 1: "1", 5: "5", 10: "10", 15: "15", 25: "25" }} />
              </Form.Item>
              <Form.Item label="Base Delivery Fee" name="baseDeliveryFee" tooltip="Default delivery fee when no distance tier or zone matches. Leave empty for no base fee.">
                <InputNumber style={{ width: "100%" }} min={0} addonBefore={"\u20B9"} placeholder="No base fee" />
              </Form.Item>
              <Form.Item label="Free Delivery Threshold" name="freeDeliveryThreshold" tooltip="Orders above this amount get free delivery. Leave empty for no free delivery threshold.">
                <InputNumber style={{ width: "100%" }} min={0} addonBefore={"\u20B9"} placeholder="No threshold" />
              </Form.Item>
              <Form.Item label="Minimum Order Amount" name="minOrderAmount" tooltip="Customers must meet this minimum to place an order. Leave empty for no minimum.">
                <InputNumber style={{ width: "100%" }} min={0} addonBefore={"\u20B9"} placeholder="No minimum" />
              </Form.Item>
            </Card>

            <Card title={sectionTitle(<CalendarOutlined />, "Subscriptions")} size="small" style={{ marginTop: 16 }}>
              <Form.Item label="Enable Subscriptions" name="subscriptionEnabled" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item label="Delivery Mode" name="subscriptionDeliveryMode">
                <Radio.Group>
                  <Radio value="DEDICATED">Dedicated Window</Radio>
                  <Radio value="SLOT_BASED">Regular Slots</Radio>
                </Radio.Group>
              </Form.Item>
              <Row gutter={12}>
                <Col span={8}>
                  <Form.Item label="Window Start" name="subscriptionWindowStart" tooltip="e.g. 06:00">
                    <Input placeholder="06:00" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Window End" name="subscriptionWindowEnd" tooltip="e.g. 08:00">
                    <Input placeholder="08:00" />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label="Cutoff Time" name="subscriptionCutoffTime" tooltip="Time by which basket is finalized (e.g. 22:00)">
                    <Input placeholder="22:00" />
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
