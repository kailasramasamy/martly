import { useEffect, useState } from "react";
import { App, Alert, type FormInstance, Button, Card, Form, Input, Radio, Select, Switch } from "antd";
import { RocketOutlined } from "@ant-design/icons";
import { useGetIdentity, useList, useNavigation } from "@refinedev/core";
import { Link } from "react-router";
import { isAxiosError } from "axios";
import { sectionTitle } from "../../theme";
import { ImageUpload } from "../../components/ImageUpload";
import { useEntitlements } from "../../hooks/use-entitlements";
import { ImageGuidance } from "../brand-campaigns/creative-section";
import { createPromo } from "./promo-utils";

interface Identity {
  role: string;
}

const PLACEHOLDER = 'e.g. "paneer 5% off", "ghee products", "fresh fruits", "daily deals", "natural soaps"';

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
        options={[{ value: "ai", label: "Let AI design it" }, { value: "upload", label: "Upload my own" }]}
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

function PromoAllowance({ left, topUp }: { left: number; topUp: number }) {
  if (left + topUp > 0) return <Alert type="info" showIcon style={{ marginBottom: 16 }} message={`Promotions left: ${left} this month + ${topUp} extra`} />;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 16 }}
      message="No promotions left"
      description={<Link to="/marketing-plan">Buy an extra promotion or upgrade</Link>}
    />
  );
}

/** What the organisation's plan still allows; the platform admin is unlimited */
function usePromoAllowance(role: string | undefined, form: FormInstance) {
  const isPlatform = role === "SUPER_ADMIN";
  const { entitlements } = useEntitlements(!!role && !isPlatform);
  const noAllowance = !!entitlements && entitlements.promotions.planLeft + entitlements.promotions.topUpBalance === 0;
  const pushAllowed = isPlatform || !!entitlements?.pushIncluded;

  useEffect(() => {
    if (role && !pushAllowed) form.setFieldValue("notify", false);
  }, [role, pushAllowed, form]);
  return { entitlements, isPlatform, noAllowance, pushAllowed };
}

export function PromoCreateCard() {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<Identity>();
  const { show } = useNavigation();
  const [form] = Form.useForm();
  const [creating, setCreating] = useState(false);
  const [imageChoice, setImageChoice] = useState<ImageChoice>("ai");
  const { entitlements, isPlatform, noAllowance, pushAllowed } = usePromoAllowance(identity?.role, form);

  const submit = async (values: { brief: string; autoLaunch: boolean; notify: boolean; organizationId?: string; imageUrl?: string }) => {
    setCreating(true);
    try {
      const imageUrl = imageChoice === "upload" ? values.imageUrl : undefined;
      const id = await createPromo({ ...values, imageUrl, brief: values.brief.trim() });
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
        {entitlements && !isPlatform && <PromoAllowance left={entitlements.promotions.planLeft} topUp={entitlements.promotions.topUpBalance} />}
        {isPlatform && <OrganizationField />}
        <Form.Item
          label="What do you want to promote?"
          name="brief"
          rules={[{ required: true, min: 3, whitespace: true, message: "Enter at least 3 characters" }]}
        >
          <Input.TextArea rows={2} maxLength={200} showCount placeholder={PLACEHOLDER} />
        </Form.Item>
        <PromoImageChoice choice={imageChoice} onChange={setImageChoice} />
        <Form.Item label="Launch automatically" name="autoLaunch" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="Notify customers" name="notify" valuePropName="checked" help={pushAllowed ? "One push per day at most" : "Push notifications come with the Pro plan"}>
          <Switch disabled={!pushAllowed} />
        </Form.Item>
        <Button type="primary" htmlType="submit" icon={<RocketOutlined />} loading={creating} disabled={noAllowance}>
          Create
        </Button>
      </Form>
    </Card>
  );
}
