import { useState, useEffect } from "react";
import { App, Card, Form, InputNumber, Switch, Button, Space, Spin, Typography, Row, Col, Alert } from "antd";
import { SettingOutlined, UsergroupAddOutlined, GiftOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";

const { Text } = Typography;

export const ReferralSettings = () => {
  const { notification } = App.useApp();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasExisting, setHasExisting] = useState(false);

  useEffect(() => {
    axiosInstance.get("/referrals/config")
      .then((res) => {
        const data = res?.data?.data;
        if (data) {
          form.setFieldsValue({
            isEnabled: data.isEnabled,
            referrerReward: data.referrerReward,
            refereeReward: data.refereeReward,
            maxReferralsPerUser: data.maxReferralsPerUser,
          });
          setHasExisting(true);
        } else {
          form.setFieldsValue({
            isEnabled: true,
            referrerReward: 50,
            refereeReward: 25,
            maxReferralsPerUser: 50,
          });
        }
      })
      .catch(() => {
        form.setFieldsValue({
          isEnabled: true,
          referrerReward: 50,
          refereeReward: 25,
          maxReferralsPerUser: 50,
        });
      })
      .finally(() => setLoading(false));
  }, [form]);

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await axiosInstance.put("/referrals/config", values);
      notification.success({ message: "Success", description: "Referral settings saved" });
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
            <UsergroupAddOutlined style={{ color: "#0d9488" }} />
            Referral Program Settings
          </Space>
        </h2>
        <Text type="secondary">
          Configure referral rewards for your organization
        </Text>
      </div>

      <Form form={form} layout="vertical">
        <Card size="small" style={{ marginBottom: 16 }}>
          <Form.Item
            name="isEnabled"
            label="Enable Referral Program"
            valuePropName="checked"
            style={{ marginBottom: 0 }}
          >
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Card>

        <Row gutter={16}>
          <Col xs={24} sm={12}>
            <Card
              title={sectionTitle(<GiftOutlined />, "Rewards")}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                name="referrerReward"
                label="Referrer reward (₹)"
                rules={[{ required: true }]}
                extra="Wallet credit given to the person who refers"
              >
                <InputNumber min={0} max={10000} prefix="₹" style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item
                name="refereeReward"
                label="Referee reward (₹)"
                rules={[{ required: true }]}
                extra="Wallet credit given to the new user who was referred"
              >
                <InputNumber min={0} max={10000} prefix="₹" style={{ width: "100%" }} />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} sm={12}>
            <Card
              title={sectionTitle(<SettingOutlined />, "Limits")}
              size="small"
              style={{ marginBottom: 16 }}
            >
              <Form.Item
                name="maxReferralsPerUser"
                label="Max referrals per user"
                rules={[{ required: true }]}
                extra="Maximum number of people a single user can refer"
              >
                <InputNumber min={1} max={1000} style={{ width: "100%" }} />
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
              <li>Every user gets a unique referral code (format: <strong>MRT-XXXXXX</strong>)</li>
              <li>New users enter a referral code before their first order</li>
              <li>Rewards are credited as <strong>wallet balance</strong> when the referred user's first order is <strong>DELIVERED</strong></li>
              <li>Both referrer and referee receive their respective rewards</li>
              <li>A user can only be referred once per organization</li>
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
          {hasExisting ? "Update Settings" : "Enable Referral Program"}
        </Button>
      </Form>
    </div>
  );
};
