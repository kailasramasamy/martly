import { useState } from "react";
import { Alert, Button, Card, Col, Row, Space, Tag, Typography, App } from "antd";
import { CheckCircleFilled } from "@ant-design/icons";
import { FESTIVAL_REGIONS, STORE_SIZE_RULES, StoreSize } from "@martly/shared/constants";

import { BRAND } from "../../theme";
import { ReadableSection } from "../ReadableSection";
import { errorMessage, onboardingApi, type Onboarding } from "../../pages/onboarding/api";

const { Text, Title } = Typography;

const TIER_LABEL = { ESSENTIAL: "Essentials", STANDARD: "Everyday", EXTENDED: "Niche & premium" } as const;

/** The region the store's town shops in, and the shop format that sets how wide its catalog is */
export function SizeStep({ onboarding, onSaved }: { onboarding: Onboarding; onSaved: (o: Onboarding) => void }) {
  const { message } = App.useApp();
  const [size, setSize] = useState<StoreSize | null>(onboarding.size);
  const [saving, setSaving] = useState(false);
  const region = onboarding.region as keyof typeof FESTIVAL_REGIONS | null;

  const save = async () => {
    if (!size) return;
    setSaving(true);
    try {
      onSaved(await onboardingApi.update(onboarding.storeId, { size }));
    } catch (err) {
      message.error(errorMessage(err, "Couldn't save the size"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ReadableSection>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={region ? `Region: ${FESTIVAL_REGIONS[region]}` : "No regional catalog for this town's state"}
        description={region
          ? `Brands from ${FESTIVAL_REGIONS[region]} rank first in every aisle (Aavin, Aachi, Sakthi… for Tamil Nadu), with national brands alongside. Change the town on the Store step to switch region.`
          : "The proposal uses national brands only. Pick a South Indian town on the Store step for regional brands."}
      />
      <Row gutter={[16, 16]}>
        {Object.values(StoreSize).map((key) => {
          const rule = STORE_SIZE_RULES[key];
          const picked = size === key;
          return (
            <Col xs={24} md={8} key={key}>
              <Card
                hoverable
                onClick={() => setSize(key)}
                style={{ height: "100%", borderColor: picked ? BRAND.primary : undefined, borderWidth: picked ? 2 : 1 }}
              >
                <Space style={{ width: "100%", justifyContent: "space-between" }}>
                  <Title level={5} style={{ margin: 0 }}>{rule.label}</Title>
                  {picked && <CheckCircleFilled style={{ color: BRAND.primary, fontSize: 18 }} />}
                </Space>
                <Text type="secondary" style={{ display: "block", margin: "8px 0 12px" }}>{rule.description}</Text>
                <div style={{ marginBottom: 8 }}>{rule.tiers.map((t) => <Tag key={t}>{TIER_LABEL[t]}</Tag>)}</div>
                <Text>Up to {rule.brandsPerAisle} brands and {rule.productsPerAisle} products per aisle</Text>
              </Card>
            </Col>
          );
        })}
      </Row>
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
        <Button type="primary" disabled={!size} loading={saving} onClick={save}>Save & see the catalog</Button>
      </div>
    </ReadableSection>
  );
}
