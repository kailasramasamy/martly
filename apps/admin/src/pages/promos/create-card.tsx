import { useState } from "react";
import { App, Button, Card, Form, Input, Select, Switch } from "antd";
import { RocketOutlined } from "@ant-design/icons";
import { useGetIdentity, useList, useNavigation } from "@refinedev/core";
import { isAxiosError } from "axios";
import { sectionTitle } from "../../theme";
import { createPromo } from "./promo-utils";

interface Identity {
  role: string;
}

const PLACEHOLDER = 'e.g. "paneer 5% off", "ghee products", "fresh fruits", "daily deals", "natural soaps"';

function OrganizationField() {
  const { data, isLoading } = useList<{ id: string; name: string }>({ resource: "organizations", pagination: { pageSize: 100 } });
  return (
    <Form.Item label="Organization" name="organizationId" rules={[{ required: true, message: "Pick an organization" }]}>
      <Select
        showSearch
        optionFilterProp="label"
        loading={isLoading}
        options={(data?.data ?? []).map((o) => ({ value: o.id, label: o.name }))}
      />
    </Form.Item>
  );
}

export function PromoCreateCard() {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<Identity>();
  const { show } = useNavigation();
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);

  const submit = async (values: { brief: string; autoLaunch: boolean; notify: boolean; organizationId?: string }) => {
    setCreating(true);
    try {
      const id = await createPromo({ ...values, brief: values.brief.trim() });
      show("promos", id);
    } catch (err) {
      if (!isAxiosError(err)) throw err;
      message.error(err.response?.data?.message ?? "Could not start the promo");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Card title={sectionTitle(<RocketOutlined />, "New promo")} size="small" style={{ marginBottom: 16 }}>
      <Form form={form} layout="vertical" initialValues={{ autoLaunch: false, notify: true }} onFinish={submit}>
        {identity?.role === "SUPER_ADMIN" && <OrganizationField />}
        <Form.Item
          label="What do you want to promote?"
          name="brief"
          rules={[{ required: true, min: 3, whitespace: true, message: "Enter at least 3 characters" }]}
        >
          <Input.TextArea rows={2} maxLength={200} showCount placeholder={PLACEHOLDER} />
        </Form.Item>
        <Form.Item label="Launch automatically" name="autoLaunch" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="Notify customers" name="notify" valuePropName="checked" help="One push per day at most">
          <Switch />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<RocketOutlined />} loading={creating}>
          Create
        </Button>
      </Form>
    </Card>
  );
}
