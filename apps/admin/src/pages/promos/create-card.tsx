import { useEffect, useState } from "react";
import { App, type FormInstance, Button, Card, Form, Input, Radio, Select, Switch } from "antd";
import { RocketOutlined } from "@ant-design/icons";
import { useList, useNavigation } from "@refinedev/core";
import { isAxiosError } from "axios";
import { sectionTitle } from "../../theme";
import { ImageUpload } from "../../components/ImageUpload";
import type { Entitlements } from "../marketing/types";
import { ImageGuidance } from "../brand-campaigns/creative-section";
import { createPromo } from "./promo-utils";

const PLACEHOLDER = 'e.g. "Diwali sweets 10% off", "fresh fruits", "ghee products"';
const OWNER_HELP = "Martly makes the banner, picks the products and puts it live, usually in a few minutes. Your customers get a notification.";

export function OrganizationField() {
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

type ImageChoice = "ai" | "upload";

function PromoImageChoice({ choice, onChange }: { choice: ImageChoice; onChange: (c: ImageChoice) => void }) {
  return (
    <Form.Item label="Banner image">
      <Radio.Group
        value={choice}
        onChange={(e) => onChange(e.target.value)}
        options={[{ value: "ai", label: "Design for me" }, { value: "upload", label: "Upload my own" }]}
      />
      {choice === "upload" && (
        <>
          <ImageGuidance />
          <Form.Item name="imageUrl" noStyle rules={[{ required: true, message: "Upload a banner image" }]} getValueFromEvent={(url: string) => url}>
            <ImageUpload />
          </Form.Item>
        </>
      )}
    </Form.Item>
  );
}

interface Props {
  entitlements: Entitlements | null;
  isPlatform: boolean;
  noAllowance: boolean;
}

/** Customer notifications need Growth or Pro; the platform admin is unlimited */
function usePushAllowed(isPlatform: boolean, entitlements: Entitlements | null, form: FormInstance) {
  const pushAllowed = isPlatform || !!entitlements?.pushIncluded;
  useEffect(() => {
    if (entitlements && !pushAllowed) form.setFieldValue("notify", false);
  }, [entitlements, pushAllowed, form]);
  return pushAllowed;
}

function AdminOptions({ choice, onChoice, pushAllowed }: { choice: ImageChoice; onChoice: (c: ImageChoice) => void; pushAllowed: boolean }) {
  return (
    <>
      <PromoImageChoice choice={choice} onChange={onChoice} />
      <Form.Item label="Launch automatically" name="autoLaunch" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item label="Notify customers" name="notify" valuePropName="checked" help={pushAllowed ? "One push per day at most" : "Customer notifications come with Growth and Pro"}>
        <Switch disabled={!pushAllowed} />
      </Form.Item>
    </>
  );
}

export function PromoCreateCard({ entitlements, isPlatform, noAllowance }: Props) {
  const { message } = App.useApp();
  const { show } = useNavigation();
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [imageChoice, setImageChoice] = useState<ImageChoice>("ai");
  const pushAllowed = usePushAllowed(isPlatform, entitlements, form);

  const submit = async (values: { brief: string; autoLaunch: boolean; notify: boolean; organizationId?: string; imageUrl?: string }) => {
    setCreating(true);
    try {
      const brief = values.brief.trim();
      const id = await createPromo(isPlatform ? { ...values, imageUrl: imageChoice === "upload" ? values.imageUrl : undefined, brief } : { brief });
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
        {isPlatform && <OrganizationField />}
        <Form.Item
          label="What do you want to promote?"
          name="brief"
          help={isPlatform ? undefined : OWNER_HELP}
          rules={[{ required: true, min: 3, whitespace: true, message: "Enter at least 3 characters" }]}
        >
          <Input.TextArea rows={2} maxLength={200} showCount placeholder={PLACEHOLDER} />
        </Form.Item>
        {isPlatform && <AdminOptions choice={imageChoice} onChoice={setImageChoice} pushAllowed={pushAllowed} />}
        <Button type="primary" htmlType="submit" icon={<RocketOutlined />} loading={creating} disabled={noAllowance}>
          {isPlatform ? "Create" : "Start promotion"}
        </Button>
      </Form>
    </Card>
  );
}
