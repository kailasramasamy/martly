import { useEffect, useState } from "react";
import { Button, Card, Col, InputNumber, Row, Space, Statistic, Tooltip, Typography, App } from "antd";
import { AppstoreOutlined, UndoOutlined } from "@ant-design/icons";
import { STORE_SIZE_RULES } from "@martly/shared/constants";
import type { CatalogRules } from "@martly/shared/schemas";
import type { CatalogProposal } from "@martly/shared/types";

import { sectionTitle } from "../../../theme";
import { errorMessage, onboardingApi, type Onboarding } from "../../../pages/onboarding/api";
import { AisleTree } from "./AisleTree";
import { AislePanel } from "./AislePanel";
import { ApplyCatalogCard, type PricingRule } from "./ApplyCatalogCard";
import { UnpricedTable } from "./UnpricedTable";

const { Text } = Typography;

const NO_RULES: CatalogRules = { excludedSubcategoryIds: [], includedSubcategoryIds: [], excludedBrandIds: [], includedBrandIds: [] };

function savedRules(o: Onboarding): { rules: CatalogRules; pricing: PricingRule } {
  const saved = o.details.catalogRules;
  if (!saved) return { rules: NO_RULES, pricing: { discountPct: 0, openingStock: 50 } };
  const { discountPct, openingStock, ...rules } = saved;
  return { rules: { ...NO_RULES, ...rules }, pricing: { discountPct, openingStock } };
}

/** Runs the proposal for the current rules, and the chosen aisle's products alongside */
function useProposal(storeId: string, rules: CatalogRules, aisleId?: string) {
  const { message } = App.useApp();
  const [proposal, setProposal] = useState<CatalogProposal>();
  const [aisle, setAisle] = useState<Pick<CatalogProposal, "products" | "otherBrands">>();
  const [loading, setLoading] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const [all, one] = await Promise.all([
          onboardingApi.proposal(storeId, rules),
          aisleId ? onboardingApi.proposal(storeId, { ...rules, subcategoryId: aisleId }) : undefined,
        ]);
        if (!live) return;
        setProposal(all);
        setAisle(one && { products: one.products, otherBrands: one.otherBrands });
      } catch (err) {
        message.error(errorMessage(err, "Couldn't build the proposal"));
      } finally {
        if (live) setLoading(false);
      }
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [storeId, rules, aisleId, version]);

  return { proposal, aisle, loading, refresh: () => setVersion((v) => v + 1) };
}

function Totals({ proposal }: { proposal: CatalogProposal }) {
  const t = proposal.totals;
  const stats: [string, number][] = [["Aisles", t.aisles], ["Brands", t.brands], ["Products", t.products], ["Visible at launch", t.visible], ["Hidden suggestions", t.suggested], ["Sizes", t.variants], ["Need a price", t.needsPrice], ["Listed now", t.listed]];
  return (
    <Space size={32} wrap>
      {stats.map(([title, value]) => <Statistic key={title} title={title} value={value} groupSeparator="," />)}
    </Space>
  );
}

interface HeaderProps {
  proposal?: CatalogProposal;
  rules: CatalogRules;
  defaults: { brandsPerAisle: number; productsPerAisle: number; likelyPerAisle: number };
  onChange: (patch: Partial<CatalogRules>) => void;
  onReset: () => void;
}

/** Totals for the proposal and the per-aisle caps that shape it */
function CatalogHeader({ proposal, rules, defaults, onChange, onReset }: HeaderProps) {
  return (
    <Card size="small" loading={!proposal}>
      {proposal && (
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col><Totals proposal={proposal} /></Col>
          <Col>
            <Space wrap>
              <Text type="secondary">Per aisle:</Text>
              <InputNumber min={1} max={30} addonAfter="brands" placeholder={String(defaults.brandsPerAisle)} value={rules.brandsPerAisle} onChange={(v) => onChange({ brandsPerAisle: v ?? undefined })} style={{ width: 130 }} />
              <InputNumber min={1} max={200} addonAfter="products" placeholder={String(defaults.productsPerAisle)} value={rules.productsPerAisle} onChange={(v) => onChange({ productsPerAisle: v ?? undefined })} style={{ width: 150 }} />
              <Tooltip title="The aisle's top picks go live at launch; the rest are listed hidden, for the store to switch on in Stock check">
                <InputNumber min={0} max={200} addonAfter="visible" placeholder={String(defaults.likelyPerAisle)} value={rules.likelyPerAisle} onChange={(v) => onChange({ likelyPerAisle: v ?? undefined })} style={{ width: 140 }} />
              </Tooltip>
              <Button icon={<UndoOutlined />} onClick={onReset}>Reset</Button>
            </Space>
          </Col>
        </Row>
      )}
    </Card>
  );
}

interface Props { onboarding: Onboarding; onChanged: () => void; onNext: () => void }

/** The proposed catalog for the store's region and size, to adjust and eyeball before it is listed */
export function CatalogStep({ onboarding, onChanged, onNext }: Props) {
  const [rules, setRules] = useState(() => savedRules(onboarding).rules);
  const [pricing, setPricing] = useState(() => savedRules(onboarding).pricing);
  const [aisleId, setAisleId] = useState<string>();
  const [applied, setApplied] = useState(0);
  const { proposal, aisle, loading, refresh } = useProposal(onboarding.storeId, rules, aisleId);
  const size = STORE_SIZE_RULES[onboarding.size!];
  const update = (patch: Partial<CatalogRules>) => setRules((r) => ({ ...r, ...patch }));
  const selected = proposal?.departments.flatMap((d) => d.categories.flatMap((c) => c.aisles)).find((a) => a.id === aisleId);
  const afterListing = () => { refresh(); onChanged(); setApplied((n) => n + 1); };

  return (
    <Space direction="vertical" size={16} style={{ width: "100%" }}>
      <CatalogHeader proposal={proposal} rules={rules} defaults={size} onChange={update} onReset={() => setRules(NO_RULES)} />
      {proposal && (
        <Row gutter={16}>
          <Col xs={24} lg={8}>
            <Card size="small" title={sectionTitle(<AppstoreOutlined />, "Aisles")}>
              <AisleTree departments={proposal.departments} sizeTiers={size.tiers} rules={rules} selectedId={aisleId} onSelect={setAisleId} onRulesChange={update} />
            </Card>
          </Col>
          <Col xs={24} lg={16}>
            <Card size="small" style={{ minHeight: 400 }}>
              <AislePanel aisle={selected} products={aisle?.products} otherBrands={aisle?.otherBrands} loading={loading} rules={rules} onRulesChange={update} />
            </Card>
          </Col>
        </Row>
      )}
      {proposal && <ApplyCatalogCard storeId={onboarding.storeId} proposal={proposal} rules={rules} pricing={pricing} onPricingChange={setPricing} onApplied={afterListing} />}
      {proposal && proposal.totals.listed > 0 && (
        <UnpricedTable storeId={onboarding.storeId} rules={rules} openingStock={pricing.openingStock} version={applied} onListed={afterListing} />
      )}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <Button type="primary" disabled={!proposal?.totals.listed} onClick={onNext}>Next: storefront</Button>
      </div>
    </Space>
  );
}
