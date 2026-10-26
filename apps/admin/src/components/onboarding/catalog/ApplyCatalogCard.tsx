import { useState } from "react";
import { Button, Card, Col, Form, InputNumber, Popconfirm, Row, Typography, App } from "antd";
import { CloudUploadOutlined } from "@ant-design/icons";
import type { CatalogRules } from "@martly/shared/schemas";
import type { CatalogProposal } from "@martly/shared/types";

import { sectionTitle } from "../../../theme";
import { errorMessage, onboardingApi } from "../../../pages/onboarding/api";

const { Text } = Typography;

export interface PricingRule { discountPct: number; openingStock: number }

interface Props {
  storeId: string;
  proposal: CatalogProposal;
  rules: CatalogRules;
  pricing: PricingRule;
  onPricingChange: (p: PricingRule) => void;
  onApplied: () => void;
}

/** Lists the proposal at the store: MRP less the discount, with placeholder stock the owner corrects by counting */
export function ApplyCatalogCard({ storeId, proposal, rules, pricing, onPricingChange, onApplied }: Props) {
  const { message } = App.useApp();
  const [applying, setApplying] = useState(false);
  const { totals } = proposal;

  const apply = async () => {
    setApplying(true);
    try {
      const r = await onboardingApi.apply(storeId, { ...rules, ...pricing });
      message.success(`${r.created.toLocaleString("en-IN")} sizes listed, ${r.removed} removed, ${r.kept.toLocaleString("en-IN")} kept`);
      onApplied();
    } catch (err) {
      message.error(errorMessage(err, "Couldn't apply the catalog"));
    } finally {
      setApplying(false);
    }
  };

  const button = <Button type="primary" icon={<CloudUploadOutlined />} loading={applying} onClick={totals.listed ? undefined : apply}>Apply to the store</Button>;

  return (
    <Card size="small" title={sectionTitle(<CloudUploadOutlined />, "Apply the catalog")}>
      <Row gutter={16} align="bottom">
        <Col xs={12} md={6}>
          <Form.Item label="Selling price" extra="Off MRP; owners change prices later" style={{ marginBottom: 0 }}>
            <InputNumber min={0} max={50} value={pricing.discountPct} addonAfter="% off" style={{ width: "100%" }}
              onChange={(v) => onPricingChange({ ...pricing, discountPct: v ?? 0 })} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item label="Opening stock" extra="Per size, until the first stock count" style={{ marginBottom: 0 }}>
            <InputNumber min={0} max={10000} value={pricing.openingStock} style={{ width: "100%" }}
              onChange={(v) => onPricingChange({ ...pricing, openingStock: v ?? 0 })} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12} style={{ textAlign: "right" }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
            {(totals.variants - totals.needsPrice).toLocaleString("en-IN")} sizes get listed, loose staples at a suggested price; {totals.needsPrice.toLocaleString("en-IN")} with nothing to go on wait for a price below.
          </Text>
          {totals.listed > 0 ? (
            <Popconfirm title="Update the store's listings?" description="Sizes no longer proposed are removed; prices and stock already set stay." okText="Apply" onConfirm={apply}>
              {button}
            </Popconfirm>
          ) : button}
        </Col>
      </Row>
    </Card>
  );
}
