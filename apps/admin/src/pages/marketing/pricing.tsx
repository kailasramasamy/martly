import { useEffect, useState } from "react";
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Spin, Typography } from "antd";
import { SaveOutlined, TagsOutlined } from "@ant-design/icons";
import { BannerPlacementLabels, INDIAN_STATES, BRAND_PRODUCT_KINDS } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { BrandPackagesCard, StorePlansCard, TopupCard } from "./pricing-products";
import type { AdProduct } from "./types";
import { errorMessage } from "./utils";
import { ReadableSection } from "../../components/ReadableSection";

const { Text } = Typography;

type SlotLimits = Record<string, { BRAND?: number | null }>;

interface PricingConfig {
  gstPercent: number;
  slotLimits: SlotLimits;
  freeRegenerations: number;
  ownerBannerCap?: number;
  featuredBrandSlots: number;
  sellerName: string;
  sellerGstin: string | null;
  sellerState: string;
  sellerAddress: string | null;
  invoicePrefix: string;
}

/** Drops empty caps (no cap) and placements left with none */
function cleanSlotLimits(limits: SlotLimits | undefined): SlotLimits {
  const cleaned: SlotLimits = {};
  for (const [placement, caps] of Object.entries(limits ?? {})) {
    if (typeof caps?.BRAND === "number") cleaned[placement] = { BRAND: caps.BRAND };
  }
  return cleaned;
}

/** Limits for the placements brand packages run in; a placement nothing sells has no row */
function SlotLimitsCard({ products }: { products: AdProduct[] }) {
  const sold = new Set(products.filter((p) => BRAND_PRODUCT_KINDS.includes(p.kind)).map((p) => p.placement));
  return (
    <Card title="Brand campaign limits" size="small" style={{ marginBottom: 16 }}>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        How many brand campaigns can run at once in each placement. Sponsored product, Category top and featured brands
        count per category. Leave a placement empty for no limit.
      </Text>
      {Object.entries(BannerPlacementLabels).filter(([placement]) => sold.has(placement)).map(([placement, label]) => (
        <Row gutter={8} key={placement} align="middle">
          <Col span={14}><Text>{label}</Text></Col>
          <Col span={10}>
            <Form.Item name={["slotLimits", placement, "BRAND"]} style={{ marginBottom: 8 }}>
              <InputNumber min={0} precision={0} style={{ width: "100%" }} />
            </Form.Item>
          </Col>
        </Row>
      ))}
      <Row gutter={8} align="middle">
        <Col span={14}><Text>Featured brands per category at once</Text></Col>
        <Col span={10}>
          <Form.Item name="featuredBrandSlots" rules={[{ required: true }]} style={{ marginBottom: 8 }}>
            <InputNumber min={0} max={20} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
}

function InvoiceCard() {
  return (
    <Card title="GST & invoices" size="small" style={{ marginBottom: 16 }}>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="gstPercent" label="GST %" rules={[{ required: true }]}>
            <InputNumber min={0} max={100} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="freeRegenerations" label="Free redrafts per promotion" rules={[{ required: true }]}>
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="ownerBannerCap" label="Banners per store per month" extra="Banners a store can have made each month outside promotions. Store owners never see this number.">
            <InputNumber min={0} max={1000} precision={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="invoicePrefix" label="Invoice prefix" rules={[{ required: true }]}>
            <Input maxLength={10} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="sellerName" label="Seller name" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="sellerGstin" label="Seller GSTIN">
            <Input maxLength={15} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="sellerState" label="Seller state" rules={[{ required: true }]}>
            <Select showSearch options={INDIAN_STATES.map((s) => ({ value: s, label: s }))} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="sellerAddress" label="Seller address">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Col>
      </Row>
    </Card>
  );
}

export const MarketingPricing = () => {
  const { notification } = App.useApp();
  const [form] = Form.useForm<PricingConfig>();
  const [products, setProducts] = useState<AdProduct[] | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = (data: { products: AdProduct[]; config: PricingConfig }) => {
    setProducts(data.products);
    form.setFieldsValue(data.config);
  };

  useEffect(() => {
    axiosInstance.get("/marketing-admin/pricing")
      .then((res) => apply(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load pricing") }));
  }, []);

  const patch = (id: string, change: Partial<AdProduct>) =>
    setProducts((prev) => prev?.map((p) => (p.id === id ? { ...p, ...change } : p)) ?? null);

  const save = async () => {
    const config = await form.validateFields();
    setSaving(true);
    try {
      const body = { products, config: { ...config, slotLimits: cleanSlotLimits(config.slotLimits) } };
      const res = await axiosInstance.put("/marketing-admin/pricing", body);
      apply(res.data.data);
      notification.success({ message: "Pricing saved" });
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save pricing") });
    } finally {
      setSaving(false);
    }
  };

  if (!products) return <Spin style={{ display: "block", margin: "64px auto" }} />;

  const ofKind = (match: (p: AdProduct) => boolean) => products.filter(match);
  return (
    <ReadableSection>
      <h2 style={{ marginTop: 0 }}>{sectionTitle(<TagsOutlined />, "Ad pricing")}</h2>
      <StorePlansCard products={ofKind((p) => p.kind === "STORE_PLAN")} patch={patch} />
      <TopupCard products={ofKind((p) => p.kind === "PROMOTION_TOPUP")} patch={patch} />
      <BrandPackagesCard products={ofKind((p) => BRAND_PRODUCT_KINDS.includes(p.kind))} patch={patch} />
      <Form form={form} layout="vertical">
        <SlotLimitsCard products={products} />
        <InvoiceCard />
      </Form>
      <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save</Button>
      <Text type="secondary" style={{ marginLeft: 12 }}>Price changes apply to new purchases only.</Text>
    </ReadableSection>
  );
};
