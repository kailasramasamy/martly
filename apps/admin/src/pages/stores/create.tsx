import { Create, useForm, useSelect } from "@refinedev/antd";
import { useGetIdentity } from "@refinedev/core";
import { Form, Input, InputNumber, Select, Card, Row, Col, Slider } from "antd";
import { ShopOutlined, EnvironmentOutlined, AimOutlined, ShoppingCartOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";

interface Identity {
  role: string;
  organizationId?: string;
}

export const StoreCreate = () => {
  const { formProps, saveButtonProps } = useForm({ resource: "stores" });
  const { data: identity } = useGetIdentity<Identity>();

  const isSuperAdmin = identity?.role === "SUPER_ADMIN";

  const { selectProps: orgSelectProps } = useSelect({
    resource: "organizations",
    optionLabel: "name",
    optionValue: "id",
    queryOptions: { enabled: isSuperAdmin },
  });

  return (
    <Create saveButtonProps={saveButtonProps}>
      <Form
        {...formProps}
        layout="vertical"
        initialValues={
          !isSuperAdmin && identity?.organizationId
            ? { organizationId: identity.organizationId, deliveryRadius: 7 }
            : { deliveryRadius: 7 }
        }
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<ShopOutlined />, "Store Details")} size="small">
              {isSuperAdmin ? (
                <Form.Item label="Organization" name="organizationId" rules={[{ required: true }]}>
                  <Select {...orgSelectProps} placeholder="Select organization" />
                </Form.Item>
              ) : (
                <Form.Item name="organizationId" hidden>
                  <Input />
                </Form.Item>
              )}
              <Form.Item label="Name" name="name" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Slug" name="slug" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Card>
          </Col>

          <Col xs={24} lg={12}>
            <Card title={sectionTitle(<EnvironmentOutlined />, "Contact & Location")} size="small">
              <Form.Item label="Address" name="address" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
              <Form.Item label="Phone" name="phone">
                <Input />
              </Form.Item>
            </Card>

            <Card title={sectionTitle(<AimOutlined />, "Delivery Location")} size="small" style={{ marginTop: 16 }}>
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
              <Form.Item label="Delivery Radius (km)" name="deliveryRadius">
                <Slider min={1} max={25} step={0.5} marks={{ 1: "1", 5: "5", 10: "10", 15: "15", 25: "25" }} />
              </Form.Item>
            </Card>

            <Card title={sectionTitle(<ShoppingCartOutlined />, "Order & Delivery")} size="small" style={{ marginTop: 16 }}>
              <Form.Item label="Minimum Order Amount" name="minOrderAmount" tooltip="Customers must meet this minimum to place an order. Leave empty for no minimum.">
                <InputNumber style={{ width: "100%" }} min={0} addonBefore={"\u20B9"} placeholder="No minimum" />
              </Form.Item>
              <Form.Item label="Base Delivery Fee" name="baseDeliveryFee" tooltip="Default delivery fee when no distance tier or zone matches. Leave empty for no base fee.">
                <InputNumber style={{ width: "100%" }} min={0} addonBefore={"\u20B9"} placeholder="No base fee" />
              </Form.Item>
              <Form.Item label="Free Delivery Threshold" name="freeDeliveryThreshold" tooltip="Orders above this amount get free delivery. Leave empty for no free delivery threshold.">
                <InputNumber style={{ width: "100%" }} min={0} addonBefore={"\u20B9"} placeholder="No threshold" />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
    </Create>
  );
};
