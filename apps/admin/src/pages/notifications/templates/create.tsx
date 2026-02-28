import { useState } from "react";
import { Card, Form, Input, Select, Button, Typography, Space, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";

import { axiosInstance } from "../../../providers/data-provider";

const { Title } = Typography;
const { TextArea } = Input;

export const TemplateCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (values: {
    name: string;
    title: string;
    body: string;
    type: string;
    imageUrl?: string;
  }) => {
    setSaving(true);
    try {
      await axiosInstance.post("/notifications/admin/templates", {
        name: values.name,
        title: values.title,
        body: values.body,
        type: values.type,
        imageUrl: values.imageUrl || undefined,
      });
      message.success("Template created");
      navigate("/notifications/templates");
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: "16px 24px 32px", maxWidth: 720, margin: "0 auto" }}>
      <Space style={{ marginBottom: 20 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/notifications/templates")}
        />
        <Title level={4} style={{ margin: 0 }}>Create Template</Title>
      </Space>

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit} initialValues={{ type: "PROMOTIONAL" }}>
          <Form.Item
            name="name"
            label="Name"
            rules={[{ required: true, message: "Name is required" }]}
          >
            <Input placeholder="e.g. Weekend Sale Template" />
          </Form.Item>

          <Form.Item
            name="title"
            label="Title"
            rules={[
              { required: true, message: "Title is required" },
              { max: 200, message: "Max 200 characters" },
            ]}
          >
            <Input placeholder="e.g. Weekend Sale - 20% Off!" maxLength={200} />
          </Form.Item>

          <Form.Item
            name="body"
            label="Body"
            rules={[
              { required: true, message: "Body is required" },
              { max: 2000, message: "Max 2000 characters" },
            ]}
          >
            <TextArea
              rows={5}
              placeholder="Notification message body..."
              maxLength={2000}
              showCount
            />
          </Form.Item>

          <Form.Item name="type" label="Type">
            <Select
              options={[
                { label: "Promotional", value: "PROMOTIONAL" },
                { label: "General", value: "GENERAL" },
              ]}
            />
          </Form.Item>

          <Form.Item name="imageUrl" label="Image URL">
            <Input placeholder="https://example.com/image.jpg" />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>
                Create Template
              </Button>
              <Button onClick={() => navigate("/notifications/templates")}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
