import { useEffect, useState } from "react";
import { Alert, Button, Card, Checkbox, Descriptions, Popconfirm, Select, Space, Tag, Typography, App } from "antd";
import { LayoutOutlined } from "@ant-design/icons";
import { STOREFRONT_PARTS, type StorefrontPart } from "@martly/shared/schemas";
import type { StorefrontCopyResult } from "@martly/shared/types";

import { sectionTitle } from "../../theme";
import { ReadableSection } from "../ReadableSection";
import { errorMessage, onboardingApi, type Onboarding } from "../../pages/onboarding/api";

const { Text } = Typography;

const PART_LABELS: Record<StorefrontPart, { label: string; help: string }> = {
  homeLayout: { label: "Home layout & collections", help: "Sections, shelves and themed collections; collections keep only products this store sells" },
  banners: { label: "Banners", help: "Plain store banners; brand campaigns and promotions stay with the template" },
  memberships: { label: "Membership plans", help: "Plans shoppers can join, with the template's prices" },
  loyalty: { label: "Loyalty points", help: "Earn and redeem rules" },
  referrals: { label: "Referrals", help: "Referral rewards; without them, invites are off" },
  deliverySlots: { label: "Delivery slots", help: "The template store's weekly slots, for scheduled delivery" },
};

function CopyResult({ result }: { result: StorefrontCopyResult }) {
  return (
    <Card size="small" style={{ marginTop: 16 }} title="Copied">
      <Descriptions size="small" column={2}>
        <Descriptions.Item label="Collections">{result.collections}</Descriptions.Item>
        <Descriptions.Item label="Home sections">{result.sections} ({result.skippedSections} skipped)</Descriptions.Item>
        <Descriptions.Item label="Banners">{result.banners}</Descriptions.Item>
        <Descriptions.Item label="Membership plans">{result.membershipPlans}</Descriptions.Item>
        <Descriptions.Item label="Delivery slots">{result.deliverySlots}</Descriptions.Item>
        <Descriptions.Item label="Loyalty / referrals">{result.loyalty ? "Yes" : "None in template"} / {result.referrals ? "Yes" : "None in template"}</Descriptions.Item>
      </Descriptions>
      {result.droppedCollections.length > 0 && (
        <div>
          <Text type="secondary">Left out, too few products here: </Text>
          {result.droppedCollections.map((c) => <Tag key={c}>{c}</Tag>)}
        </div>
      )}
    </Card>
  );
}

/** Copies Home, collections and settings from a template organisation; safe to repeat until launch */
export function StorefrontStep({ onboarding, onChanged, onNext }: { onboarding: Onboarding; onChanged: () => void; onNext: () => void }) {
  const { message } = App.useApp();
  const [templates, setTemplates] = useState<{ id: string; name: string }[]>([]);
  const [templateId, setTemplateId] = useState<string>();
  const [parts, setParts] = useState<StorefrontPart[]>([...STOREFRONT_PARTS]);
  const [result, setResult] = useState<StorefrontCopyResult>();
  const [copying, setCopying] = useState(false);

  useEffect(() => {
    onboardingApi.templates().then((t) => { setTemplates(t); setTemplateId(t[0]?.id); }).catch((err) => message.error(errorMessage(err, "Couldn't load templates")));
  }, []);

  const copy = async () => {
    setCopying(true);
    try {
      setResult(await onboardingApi.storefront(onboarding.storeId, { templateOrganizationId: templateId!, parts }));
      onChanged();
    } catch (err) {
      message.error(errorMessage(err, "Couldn't copy the storefront"));
    } finally {
      setCopying(false);
    }
  };

  const button = <Button type="primary" loading={copying} disabled={!templateId || parts.length === 0} onClick={onboarding.storefrontCopied ? undefined : copy}>Copy storefront</Button>;

  return (
    <ReadableSection>
      <Card size="small" title={sectionTitle(<LayoutOutlined />, "Storefront from a template")}>
        {onboarding.storefrontCopied && !result && <Alert type="success" showIcon style={{ marginBottom: 12 }} message="Already copied. Copying again replaces the earlier copy." />}
        <Space direction="vertical" style={{ width: "100%" }} size={12}>
          <Select value={templateId} onChange={setTemplateId} style={{ width: 320 }} options={templates.map((t) => ({ value: t.id, label: t.name }))} placeholder="Template" />
          <Checkbox.Group value={parts} onChange={(v) => setParts(v as StorefrontPart[])} style={{ display: "grid", gap: 8 }}>
            {STOREFRONT_PARTS.map((p) => (
              <Checkbox key={p} value={p}>{PART_LABELS[p].label} <Text type="secondary" style={{ fontSize: 12 }}>· {PART_LABELS[p].help}</Text></Checkbox>
            ))}
          </Checkbox.Group>
          {onboarding.storefrontCopied ? <Popconfirm title="Replace the earlier copy?" okText="Copy again" onConfirm={copy}>{button}</Popconfirm> : button}
        </Space>
      </Card>
      {result && <CopyResult result={result} />}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
        <Text type="secondary">Skipping is fine: without a copy, shoppers see Martly's default Home.</Text>
        <Button type="primary" onClick={onNext}>Next: review</Button>
      </div>
    </ReadableSection>
  );
}
