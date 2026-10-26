import { useState } from "react";
import { Button, Card, Col, Form, Input, Row, Typography, App } from "antd";
import { ShopOutlined, UserOutlined } from "@ant-design/icons";

import { sectionTitle } from "../../theme";
import { ReadableSection } from "../ReadableSection";
import { requireEmail, TeamCard } from "./TeamCard";
import { errorMessage, onboardingApi, type Onboarding } from "../../pages/onboarding/api";

const { Text } = Typography;

export interface BusinessDraft {
  organizationName: string;
  owner: { name: string; phone: string; email?: string; password?: string };
}

interface Props {
  onboarding?: Onboarding;
  draft?: BusinessDraft;
  /** A new store hands its draft on to the store step; a saved one has been updated */
  onDone: (draft?: BusinessDraft) => void;
}

/** Who the business is and who runs it; the owner and team sign in to the app by OTP on their phones */
export function BusinessStep({ onboarding, draft, onDone }: Props) {
  const { message } = App.useApp();
  const [form] = Form.useForm<BusinessDraft>();
  const [saving, setSaving] = useState(false);
  const initial: Partial<BusinessDraft> = onboarding
    ? { organizationName: onboarding.organization.name, owner: { name: onboarding.owner?.name ?? "", phone: onboarding.owner?.phone ?? "", email: onboarding.owner?.email.endsWith("@phone.martly.app") ? undefined : onboarding.owner?.email } }
    : draft ?? {};

  const submit = async (values: BusinessDraft) => {
    const { email, password } = values.owner;
    if (!onboarding) return onDone({ ...values, owner: { ...values.owner, email: email || undefined, password: password || undefined } });
    setSaving(true);
    try {
      await onboardingApi.update(onboarding.storeId, {
        organizationName: values.organizationName,
        owner: {
          name: values.owner.name,
          ...(email ? { email } : {}),
          ...(password ? { password } : {}),
        },
      });
      onDone();
    } catch (err) {
      message.error(errorMessage(err, "Couldn't save"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReadableSection>
      <Form form={form} layout="vertical" initialValues={initial} onFinish={submit} requiredMark="optional">
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card size="small" title={sectionTitle(<ShopOutlined />, "Business")}>
              <Form.Item label="Business name" name="organizationName" rules={[{ required: true, min: 2 }]}
                extra="The organisation the store belongs to; a chain adds more stores to it later.">
                <Input placeholder="e.g. Sree Ranga Stores" />
              </Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card size="small" title={sectionTitle(<UserOutlined />, "Owner")}>
              <Form.Item label="Name" name={["owner", "name"]} rules={[{ required: true, min: 2 }]}>
                <Input placeholder="Owner's name" />
              </Form.Item>
              <Form.Item label="Mobile number" name={["owner", "phone"]} rules={[{ required: true, pattern: /^\d{10}$/, message: "10-digit mobile number" }]}
                extra={onboarding ? "The owner's login; change it from Users." : "The owner signs in to the Martly app with an OTP on this number."}>
                <Input addonBefore="+91" maxLength={10} disabled={!!onboarding} inputMode="numeric" />
              </Form.Item>
              <Form.Item label="Email" name={["owner", "email"]} rules={[{ type: "email" }]}>
                <Input placeholder="For the admin panel (optional)" />
              </Form.Item>
              <Form.Item label="Admin panel password" name={["owner", "password"]} dependencies={[["owner", "email"]]}
                extra={onboarding ? "Leave blank to keep the current one." : "With the email, the owner signs in at the admin panel too."}
                rules={[{ min: 8, message: "At least 8 characters" }, requireEmail(["owner", "email"])]}>
                <Input.Password autoComplete="new-password" placeholder="Optional" />
              </Form.Item>
            </Card>
          </Col>
        </Row>
      </Form>
      {onboarding
        ? <TeamCard storeId={onboarding.storeId} editable={onboarding.status === "PENDING"} />
        : <Text type="secondary" style={{ display: "block", marginTop: 16 }}>Store managers, staff and riders are added here once the store is created.</Text>}
      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12, marginTop: 16 }}>
        {!onboarding && <Text type="secondary">Nothing is saved until the store details are in.</Text>}
        <Button type="primary" loading={saving} onClick={() => form.submit()}>Next</Button>
      </div>
    </ReadableSection>
  );
}
