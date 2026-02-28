import { useCallback, useEffect, useState } from "react";
import { Card, Form, Input, Select, Button, Typography, Space, Spin, message } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useNavigate, useParams } from "react-router";

import { axiosInstance } from "../../../providers/data-provider";

const { Title } = Typography;
const { TextArea } = Input;

export const TemplateEdit = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchTemplate = useCallback(async () => {
    try {
      const res = await axiosInstance.get(`/notifications/admin/templates/${id}`);
      const template = res.data?.data;
      if (template) {
        form.setFieldsValue({
          name: template.name,
          title: template.title,
          body: template.body,
          type: template.type,
          imageUrl: template.imageUrl ?? undefined,
        });
      }
    } catch {
      message.error("Failed to load template");
    } finally {
      setLoading(false);
    }
  }, [id, form]);

  useEffect(() => {
    fetchTemplate();
  }, [fetchTemplate]);

  const handleSubmit = async (values: {
    name: string;
    title: string;
    body: string;
    type: string;
    imageUrl?: string;
  }) => {
    setSaving(true);
    try {
      await axiosInstance.put(`/notifications/admin/templates/${id}`, {
        name: values.name,
        title: values.title,
        body: values.body,
        type: values.type,
        imageUrl: values.imageUrl || undefined,
      });
      message.success("Template updated");
      navigate("/notifications/templates");
    } catch (err: any) {
      message.error(err?.response?.data?.message ?? "Failed to update template");
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
    <div style={{ padding: "16px 24px 32px", maxWidth: 720, margin: "0 auto" }}>
      <Space style={{ marginBottom: 20 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/notifications/templates")}
        />
        <Title level={4} style={{ margin: 0 }}>Edit Template</Title>
      </Space>

      <Card>
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
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
                Save Changes
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
