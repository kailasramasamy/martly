import { useState } from "react";
import { Card, Form, Input, Button, Select, Typography, Alert, Space } from "antd";
import { SendOutlined } from "@ant-design/icons";
import { useList } from "@refinedev/core";
import { axiosInstance } from "../../providers/data-provider";

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

export const NotificationSend = () => {
  const [form] = Form.useForm();
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deepLinkType = Form.useWatch("deepLinkType", form);

  const { data: storesData } = useList({
    resource: "stores",
    pagination: { pageSize: 100 },
  });
  const stores = storesData?.data ?? [];

  const { data: categoriesData } = useList({
    resource: "categories",
    pagination: { pageSize: 200 },
  });
  const categories = categoriesData?.data ?? [];

  const { data: productsData } = useList({
    resource: "products",
    pagination: { pageSize: 200 },
  });
  const products = productsData?.data ?? [];

  const handleSend = async (values: {
    title: string;
    body: string;
    type?: string;
    imageUrl?: string;
    storeId?: string;
    deepLinkType?: string;
    deepLinkId?: string;
  }) => {
    setSending(true);
    setResult(null);
    setError(null);

    try {
      const res = await axiosInstance.post("/notifications/send", {
        title: values.title,
        body: values.body,
        type: values.type || "PROMOTIONAL",
        imageUrl: values.imageUrl || undefined,
        storeId: values.storeId || undefined,
        deepLinkType: values.deepLinkType || undefined,
        deepLinkId: values.deepLinkId || undefined,
      });
      setResult(res.data?.data);
      form.resetFields();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? err?.message ?? "Failed to send notification");
    } finally {
      setSending(false);
    }
  };

  const renderDeepLinkIdField = () => {
    if (!deepLinkType) return null;

    switch (deepLinkType) {
      case "product":
        return (
          <Form.Item name="deepLinkId" label="Target Product" rules={[{ required: true, message: "Select a product" }]}>
            <Select
              showSearch
              placeholder="Select a product"
              optionFilterProp="label"
              options={products.map((p: any) => ({ label: p.name, value: p.id }))}
            />
          </Form.Item>
        );
      case "category":
        return (
          <Form.Item name="deepLinkId" label="Target Category" rules={[{ required: true, message: "Select a category" }]}>
            <Select
              showSearch
              placeholder="Select a category"
              optionFilterProp="label"
              options={categories.map((c: any) => ({ label: c.name, value: c.id }))}
            />
          </Form.Item>
        );
      case "store":
        return (
          <Form.Item name="deepLinkId" label="Target Store" rules={[{ required: true, message: "Select a store" }]}>
            <Select
              showSearch
              placeholder="Select a store"
              optionFilterProp="label"
              options={stores.map((s: any) => ({ label: s.name, value: s.id }))}
            />
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

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      <Title level={4}>Send Notification</Title>
      <Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        Send a notification to all customers who have ordered from your stores.
      </Text>

      {result && (
        <Alert
          message={`Notification sent to ${result.sent} customer${result.sent !== 1 ? "s" : ""}`}
          type="success"
          showIcon
          closable
          onClose={() => setResult(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      {error && (
        <Alert
          message={error}
          type="error"
          showIcon
          closable
          onClose={() => setError(null)}
          style={{ marginBottom: 16 }}
        />
      )}

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSend}>
          <Form.Item
            name="title"
            label="Title"
            rules={[{ required: true, message: "Title is required" }, { max: 200, message: "Max 200 characters" }]}
          >
            <Input placeholder="e.g. Weekend Sale - 20% Off!" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="body"
            label="Message"
            rules={[{ required: true, message: "Message is required" }, { max: 1000, message: "Max 1000 characters" }]}
          >
            <TextArea rows={3} placeholder="e.g. Shop now and get 20% off on all groceries this weekend!" maxLength={1000} showCount />
          </Form.Item>

          <Form.Item name="type" label="Type" initialValue="PROMOTIONAL">
            <Select
              options={[
                { label: "Promotional", value: "PROMOTIONAL" },
                { label: "General / Informational", value: "GENERAL" },
              ]}
            />
          </Form.Item>

          <Form.Item name="imageUrl" label="Image URL (optional)">
            <Input placeholder="https://example.com/promo-banner.jpg" />
          </Form.Item>

          <Form.Item name="storeId" label="Target Store (optional)">
            <Select
              allowClear
              placeholder="All stores (send to all org customers)"
              options={stores.map((s: any) => ({ label: s.name, value: s.id }))}
            />
          </Form.Item>

          <Form.Item name="deepLinkType" label="Deep Link Target (optional)">
            <Select
              allowClear
              placeholder="None — taps go to home screen"
              options={DEEP_LINK_OPTIONS}
              onChange={() => form.setFieldValue("deepLinkId", undefined)}
            />
          </Form.Item>

          {renderDeepLinkIdField()}

          <Form.Item>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined />}
                loading={sending}
              >
                Send Notification
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
