import { useState, useEffect } from "react";
import { App, Card, Form, InputNumber, Switch, Button, Space, Spin, Typography, Row, Col, Alert } from "antd";
import { SettingOutlined, StarOutlined, GiftOutlined, PercentageOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

const { Text } = Typography;

interface LoyaltyConfig {
  id?: string;
  isEnabled: boolean;
  earnRate: number;
  minRedeemPoints: number;
  maxRedeemPercentage: number;
  reviewRewardPoints: number;
}

export const LoyaltySettings = () => {
  const { notification } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    axiosInstance.get("/loyalty/config")
      .then((res) => {
        const data = res?.data?.data;
        if (data) {
          form.setFieldsValue({
            isEnabled: data.isEnabled,
            earnRate: data.earnRate,
            minRedeemPoints: data.minRedeemPoints,
            maxRedeemPercentage: data.maxRedeemPercentage,
            reviewRewardPoints: data.reviewRewardPoints ?? 0,
          });
          setHasExisting(true);
        } else {
          form.setFieldsValue({
            isEnabled: true,
            earnRate: 1,
            minRedeemPoints: 10,
            maxRedeemPercentage: 50,
            reviewRewardPoints: 0,
          });
        }
      })
      .catch(() => {
        form.setFieldsValue({
          isEnabled: true,
          earnRate: 1,
          minRedeemPoints: 10,
          maxRedeemPercentage: 50,
          reviewRewardPoints: 0,
        });
      })
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await axiosInstance.put("/loyalty/config", values);
      notification.success({ message: "Success", description: "Loyalty settings saved" });
      setHasExisting(true);
    } catch (err: any) {
      notification.error({ message: "Error", description: err?.response?.data?.message ?? "Failed to save settings" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <Space>
            <StarOutlined style={{ color: "#d97706" }} />
            Loyalty Program Settings
          </Space>
        </h2>
        <Text type="secondary">
          Configure how customers earn and redeem loyalty points
        </Text>
      </div>

      <Form form={form} layout="vertical">
        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="isEnabled"
            label="Enable Loyalty Program"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Card>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Card
              title={sectionTitle(<StarOutlined />, "Earning")}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                name="earnRate"
                label="Points per ₹100 spent"
                rules={[{ required: true }]}
                extra="Customers earn this many points for every ₹100 in their order total"
              >
                <InputNumber min={0} max={100} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="reviewRewardPoints"
                label="Review reward points"
                extra="Points awarded when a verified review is approved (0 = disabled)"
              >
                <InputNumber min={0} max={1000} style={{ width: "100%" }} />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              title={sectionTitle(<GiftOutlined />, "Redemption")}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                name="minRedeemPoints"
                label="Minimum points to redeem"
                rules={[{ required: true }]}
                extra="Customers need at least this many points before they can use them"
              >
                <InputNumber min={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="maxRedeemPercentage"
                label="Max % of order payable with points"
                rules={[{ required: true }]}
                extra="Caps the discount from loyalty points as a percentage of order total"
              >
                <InputNumber min={1} max={100} addonAfter="%" style={{ width: "100%" }} />
              </Form.Item>
            </Card>
          </Col>
        </Row>

        <Alert
          type="info"
          showIcon
          message="How it works"
          description={
            <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
              <li>Points are <strong>org-scoped</strong> — earned at any store, redeemable at any store in the same org</li>
              <li>Points are credited when an order reaches <strong>DELIVERED</strong> status</li>
              <li><strong>1 point = ₹1</strong> discount at checkout</li>
              <li>Checkout deduction order: Coupon → Delivery → Wallet → <strong>Loyalty</strong> → Payment</li>
              <li>Points are reversed when an order is cancelled</li>
            </ul>
          }
          style={{ marginBottom: 16 }}
        />

        <Button
          type="primary"
          icon={<SettingOutlined />}
          onClick={handleSave}
          loading={saving}
          size="large"
        >
          {hasExisting ? "Update Settings" : "Enable Loyalty Program"}
        </Button>
      </Form>
    </div>
  );
};
