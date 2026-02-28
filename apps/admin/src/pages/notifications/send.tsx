import { useState, useEffect, useCallback } from "react";
import {
  Card,
  Form,
  Input,
  Button,
  Select,
  Typography,
  Alert,
  Space,
  Row,
  Col,
  InputNumber,
  Switch,
  DatePicker,
  Badge,
  Spin,
  Divider,
  Progress,
  message,
} from "antd";
import {
  SendOutlined,
  ClockCircleOutlined,
  UserOutlined,
  TeamOutlined,
  BellOutlined,
} from "@ant-design/icons";
import { theme as antTheme } from "antd";
import { useList } from "@refinedev/core";
import { axiosInstance } from "../../providers/data-provider";
import { BRAND } from "../../theme";

const { Title, Text } = Typography;
const { TextArea } = Input;

const DEEP_LINK_OPTIONS = [
  { label: "None", value: "" },
  { label: "Product", value: "product" },
  { label: "Category", value: "category" },
  { label: "Store", value: "store" },
  { label: "Screen", value: "screen" },
];

const SCREEN_OPTIONS = [
  { label: "Home", value: "home" },
  { label: "Categories", value: "categories" },
  { label: "Orders", value: "orders" },
  { label: "Wallet", value: "wallet" },
  { label: "Loyalty Points", value: "loyalty" },
  { label: "Wishlist", value: "wishlist" },
  { label: "Search", value: "search" },
];

const AUDIENCE_OPTIONS = [
  { label: "All Customers", value: "ALL_CUSTOMERS", description: "Everyone who has ordered from your stores" },
  { label: "Store Customers", value: "STORE_CUSTOMERS", description: "Customers of a specific store" },
  { label: "Ordered Recently", value: "ORDERED_LAST_N_DAYS", description: "Customers who ordered in the last N days" },
  { label: "Inactive Customers", value: "NOT_ORDERED_N_DAYS", description: "Win-back: haven't ordered in N days" },
  { label: "High Value", value: "HIGH_VALUE_CUSTOMERS", description: "Customers with total spend above threshold" },
];

interface SendProgress {
  campaignId: string;
  recipientCount: number;
  deliveredCount: number;
  status: string;
}

export const NotificationSend = () => {
  const { token } = antTheme.useToken();
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState<SendProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState(false);
  const [audienceCount, setAudienceCount] = useState<number | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [templates, setTemplates] = useState<any[]>([]);

  const deepLinkType = Form.useWatch("deepLinkType", form);
  const audienceType = Form.useWatch("audienceType", form);
  const title = Form.useWatch("title", form);
  const body = Form.useWatch("body", form);
  const imageUrl = Form.useWatch("imageUrl", form);

  const { data: storesData } = useList({ resource: "stores", pagination: { pageSize: 100 } });
  const stores = storesData?.data ?? [];

  const { data: categoriesData } = useList({ resource: "categories", pagination: { pageSize: 200 } });
  const categories = categoriesData?.data ?? [];

  const { data: productsData } = useList({ resource: "products", pagination: { pageSize: 200 } });
  const products = productsData?.data ?? [];

  // Load templates
  useEffect(() => {
    axiosInstance.get("/notifications/admin/templates?pageSize=100")
      .then((res) => setTemplates(res.data?.data ?? []))
      .catch(() => {});
  }, []);

  // Audience preview
  const previewAudience = useCallback(async () => {
    const values = form.getFieldsValue();
    const at = values.audienceType || "ALL_CUSTOMERS";
    const config: Record<string, any> = {};
    if (at === "STORE_CUSTOMERS" && values.audienceStoreId) config.storeId = values.audienceStoreId;
    if ((at === "ORDERED_LAST_N_DAYS" || at === "NOT_ORDERED_N_DAYS") && values.audienceDays) config.days = values.audienceDays;
    if (at === "HIGH_VALUE_CUSTOMERS" && values.audienceMinAmount) config.minAmount = values.audienceMinAmount;

    setLoadingPreview(true);
    try {
      const res = await axiosInstance.post("/notifications/admin/audience-preview", {
        audienceType: at,
        audienceConfig: Object.keys(config).length > 0 ? config : undefined,
      });
      setAudienceCount(res.data?.data?.count ?? 0);
    } catch {
      setAudienceCount(null);
    } finally {
      setLoadingPreview(false);
    }
  }, [form]);

  useEffect(() => {
    previewAudience();
  }, [audienceType]);

  const handleTemplateSelect = (templateId: string) => {
    const t = templates.find((t: any) => t.id === templateId);
    if (t) {
      form.setFieldsValue({
        title: t.title,
        body: t.body,
        type: t.type,
        imageUrl: t.imageUrl || undefined,
      });
    }
  };

  // Poll campaign progress until SENT or FAILED
  const pollProgress = useCallback((campaignId: string, recipientCount: number) => {
    setProgress({ campaignId, recipientCount, deliveredCount: 0, status: "SENDING" });

    const interval = setInterval(async () => {
      try {
        const res = await axiosInstance.get(`/notifications/admin/campaigns/${campaignId}`);
        const data = res.data?.data;
        const delivered = data?._count?.notifications ?? 0;
        const status = data?.status ?? "SENDING";

        setProgress({ campaignId, recipientCount, deliveredCount: delivered, status });

        if (status === "SENT" || status === "FAILED") {
          clearInterval(interval);
          setSending(false);
          if (status === "SENT") {
            message.success(`Campaign sent to ${recipientCount} customers`);
          } else {
            message.error("Campaign failed to send");
          }
          // Clear progress after a short delay so the user sees 100%
          setTimeout(() => setProgress(null), 3000);
          form.resetFields();
          setScheduled(false);
          setAudienceCount(null);
        }
      } catch {
        clearInterval(interval);
        setSending(false);
        setProgress(null);
        message.error("Failed to check campaign status");
      }
    }, 1500);

    // Safety: stop polling after 5 minutes
    setTimeout(() => clearInterval(interval), 300_000);
  }, [form]);

  const handleSend = async (values: any) => {
    setSending(true);
    setProgress(null);
    setError(null);

    try {
      const config: Record<string, any> = {};
      if (values.audienceType === "STORE_CUSTOMERS" && values.audienceStoreId) config.storeId = values.audienceStoreId;
      if ((values.audienceType === "ORDERED_LAST_N_DAYS" || values.audienceType === "NOT_ORDERED_N_DAYS") && values.audienceDays) config.days = values.audienceDays;
      if (values.audienceType === "HIGH_VALUE_CUSTOMERS" && values.audienceMinAmount) config.minAmount = values.audienceMinAmount;

      const payload: Record<string, any> = {
        title: values.title,
        body: values.body,
        type: values.type || "PROMOTIONAL",
        imageUrl: values.imageUrl || undefined,
        audienceType: values.audienceType || "ALL_CUSTOMERS",
        audienceConfig: Object.keys(config).length > 0 ? config : undefined,
        deepLinkType: values.deepLinkType || undefined,
        deepLinkId: values.deepLinkId || undefined,
      };

      if (scheduled && values.scheduledAt) {
        payload.scheduledAt = values.scheduledAt.toISOString();
      }

      const res = await axiosInstance.post("/notifications/admin/send", payload);
      const data = res.data?.data;

      if (data?.status === "SCHEDULED") {
        message.success("Campaign scheduled successfully!");
        setSending(false);
        form.resetFields();
        setScheduled(false);
        setAudienceCount(null);
      } else if (data?.status === "SENDING") {
        // Start polling for progress
        pollProgress(data.campaignId, data.recipientCount);
      } else {
        // Fallback for unexpected response
        message.success("Campaign sent!");
        setSending(false);
        form.resetFields();
        setScheduled(false);
        setAudienceCount(null);
      }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Failed to send");
      setSending(false);
    }
  };

  const renderDeepLinkIdField = () => {
    if (!deepLinkType) return null;
    switch (deepLinkType) {
      case "product":
        return (
          <Form.Item name="deepLinkId" label="Target Product" rules={[{ required: true, message: "Select a product" }]}>
            <Select showSearch placeholder="Select a product" optionFilterProp="label" options={products.map((p: any) => ({ label: p.name, value: p.id }))} />
          </Form.Item>
        );
      case "category":
        return (
          <Form.Item name="deepLinkId" label="Target Category" rules={[{ required: true, message: "Select a category" }]}>
            <Select showSearch placeholder="Select a category" optionFilterProp="label" options={categories.map((c: any) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
        );
      case "store":
        return (
          <Form.Item name="deepLinkId" label="Target Store" rules={[{ required: true, message: "Select a store" }]}>
            <Select showSearch placeholder="Select a store" optionFilterProp="label" options={stores.map((s: any) => ({ label: s.name, value: s.id }))} />
          </Form.Item>
        );
      case "screen":
        return (
          <Form.Item name="deepLinkId" label="Target Screen" rules={[{ required: true, message: "Select a screen" }]}>
            <Select placeholder="Select a screen" options={SCREEN_OPTIONS} />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  const renderAudienceConfig = () => {
    switch (audienceType) {
      case "STORE_CUSTOMERS":
        return (
          <Form.Item name="audienceStoreId" label="Store" rules={[{ required: true, message: "Select a store" }]}>
            <Select placeholder="Select store" options={stores.map((s: any) => ({ label: s.name, value: s.id }))} onChange={() => setTimeout(previewAudience, 100)} />
          </Form.Item>
        );
      case "ORDERED_LAST_N_DAYS":
        return (
          <Form.Item name="audienceDays" label="Ordered in last N days" initialValue={30}>
            <InputNumber min={1} max={365} style={{ width: "100%" }} onChange={() => setTimeout(previewAudience, 100)} />
          </Form.Item>
        );
      case "NOT_ORDERED_N_DAYS":
        return (
          <Form.Item name="audienceDays" label="Not ordered in last N days" initialValue={30}>
            <InputNumber min={1} max={365} style={{ width: "100%" }} onChange={() => setTimeout(previewAudience, 100)} />
          </Form.Item>
        );
      case "HIGH_VALUE_CUSTOMERS":
        return (
          <Form.Item name="audienceMinAmount" label="Min total spend (\u20B9)" initialValue={1000}>
            <InputNumber min={100} step={500} style={{ width: "100%" }} onChange={() => setTimeout(previewAudience, 100)} />
          </Form.Item>
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ padding: "16px 24px 32px" }}>
      <Title level={4} style={{ marginBottom: 4 }}>Send Notification</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Compose and send or schedule a notification campaign to your customers.
      </Text>

      {error && (
        <Alert message={error} type="error" showIcon closable onClose={() => setError(null)} style={{ marginBottom: 16 }} />
      )}

      {progress && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }} size={8}>
            <Space>
              <SendOutlined spin={progress.status === "SENDING"} style={{ color: BRAND.primary }} />
              <Text strong>
                {progress.status === "SENDING"
                  ? "Sending notifications..."
                  : progress.status === "SENT"
                    ? "Campaign sent!"
                    : "Campaign failed"}
              </Text>
              <Text type="secondary">
                {progress.deliveredCount} / {progress.recipientCount} delivered
              </Text>
            </Space>
            <Progress
              percent={progress.recipientCount > 0 ? Math.round((progress.deliveredCount / progress.recipientCount) * 100) : 0}
              status={progress.status === "FAILED" ? "exception" : progress.status === "SENT" ? "success" : "active"}
              strokeColor={BRAND.primary}
              size="small"
            />
          </Space>
        </Card>
      )}

      <Row gutter={24}>
        {/* Left column — Form */}
        <Col xs={24} lg={15}>
          <Card>
            <Form form={form} layout="vertical" onFinish={handleSend} initialValues={{ type: "PROMOTIONAL", audienceType: "ALL_CUSTOMERS" }}>
              {/* Template selector */}
              {templates.length > 0 && (
                <Form.Item label="Load from Template">
                  <Select
                    allowClear
                    placeholder="Choose a template..."
                    onChange={handleTemplateSelect}
                    options={templates.map((t: any) => ({
                      label: `${t.name} — ${t.title}`,
                      value: t.id,
                    }))}
                  />
                </Form.Item>
              )}

              <Form.Item name="title" label="Title" rules={[{ required: true, message: "Title is required" }, { max: 200 }]}>
                <Input placeholder="e.g. Weekend Sale - 20% Off!" maxLength={200} />
              </Form.Item>

              <Form.Item name="body" label="Message" rules={[{ required: true, message: "Message is required" }, { max: 2000 }]}>
                <TextArea rows={4} placeholder="e.g. Shop now and get 20% off on all groceries this weekend!" maxLength={2000} showCount />
              </Form.Item>

              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item name="type" label="Type">
                    <Select
                      options={[
                        { label: "Promotional", value: "PROMOTIONAL" },
                        { label: "General", value: "GENERAL" },
                      ]}
                    />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item name="imageUrl" label="Image URL (optional)">
                    <Input placeholder="https://..." />
                  </Form.Item>
                </Col>
              </Row>

              <Divider>Audience</Divider>

              <Form.Item name="audienceType" label="Target Audience">
                <Select options={AUDIENCE_OPTIONS} />
              </Form.Item>

              {renderAudienceConfig()}

              {audienceCount !== null && (
                <div style={{ marginBottom: 16 }}>
                  <Badge
                    count={loadingPreview ? <Spin size="small" /> : `~${audienceCount} customers`}
                    style={{
                      backgroundColor: audienceCount > 0 ? BRAND.primary : "#999",
                      fontSize: 13,
                      padding: "0 12px",
                      height: 24,
                      lineHeight: "24px",
                    }}
                    overflowCount={999999}
                  />
                </div>
              )}

              <Divider>Deep Link (optional)</Divider>

              <Form.Item name="deepLinkType" label="Deep Link Target">
                <Select
                  allowClear
                  placeholder="None — taps go to home screen"
                  options={DEEP_LINK_OPTIONS}
                  onChange={() => form.setFieldValue("deepLinkId", undefined)}
                />
              </Form.Item>

              {renderDeepLinkIdField()}

              <Divider>Scheduling</Divider>

              <Space align="center" style={{ marginBottom: 16 }}>
                <Switch checked={scheduled} onChange={setScheduled} />
                <Text>Schedule for later</Text>
              </Space>

              {scheduled && (
                <Form.Item name="scheduledAt" label="Send At" rules={[{ required: true, message: "Select date & time" }]}>
                  <DatePicker showTime format="YYYY-MM-DD HH:mm" style={{ width: "100%" }} />
                </Form.Item>
              )}

              <Form.Item style={{ marginTop: 24 }}>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={scheduled ? <ClockCircleOutlined /> : <SendOutlined />}
                  loading={sending}
                  size="large"
                  style={{ minWidth: 200 }}
                >
                  {scheduled ? "Schedule Campaign" : "Send Now"}
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </Col>

        {/* Right column — Preview */}
        <Col xs={24} lg={9}>
          <Card
            title={<Space><BellOutlined style={{ color: BRAND.primary }} /> Preview</Space>}
            style={{ position: "sticky", top: 80 }}
          >
            <div
              style={{
                background: token.colorBgLayout,
                borderRadius: 12,
                padding: 16,
                border: `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              {/* Mock phone notification */}
              <div
                style={{
                  background: token.colorBgContainer,
                  borderRadius: 12,
                  padding: 14,
                  boxShadow: `0 1px 3px ${token.colorFillQuaternary}`,
                }}
              >
                <Space align="start" style={{ width: "100%" }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      background: BRAND.primary,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <BellOutlined style={{ color: "#fff", fontSize: 16 }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Text strong style={{ fontSize: 13 }}>Martly</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>now</Text>
                    </div>
                    <Text strong style={{ fontSize: 14, display: "block", marginTop: 2 }}>
                      {title || "Notification Title"}
                    </Text>
                    <Text
                      style={{
                        fontSize: 13,
                        color: token.colorTextSecondary,
                        display: "-webkit-box",
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        marginTop: 2,
                      }}
                    >
                      {body || "Your notification message will appear here..."}
                    </Text>
                  </div>
                </Space>

                {imageUrl && (
                  <div style={{ marginTop: 10, borderRadius: 8, overflow: "hidden" }}>
                    <img
                      src={imageUrl}
                      alt="preview"
                      style={{ width: "100%", height: 120, objectFit: "cover", borderRadius: 8 }}
                      onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                    />
                  </div>
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, padding: "0 4px" }}>
              <Space direction="vertical" size={4} style={{ width: "100%" }}>
                <Space>
                  <TeamOutlined style={{ color: BRAND.primary }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {audienceCount !== null ? `~${audienceCount} recipients` : "Calculating..."}
                  </Text>
                </Space>
                <Space>
                  <UserOutlined style={{ color: BRAND.primary }} />
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {AUDIENCE_OPTIONS.find((o) => o.value === audienceType)?.label ?? "All Customers"}
                  </Text>
                </Space>
                {scheduled && (
                  <Space>
                    <ClockCircleOutlined style={{ color: BRAND.warning }} />
                    <Text type="secondary" style={{ fontSize: 12 }}>Scheduled</Text>
                  </Space>
                )}
              </Space>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
