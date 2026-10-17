import { useEffect, useState } from "react";
import { App, Button, Card, Col, Form, Input, InputNumber, Row, Select, Spin, Typography } from "antd";
import { SaveOutlined, TagsOutlined } from "@ant-design/icons";
import { BannerPlacementLabels, INDIAN_STATES, BRAND_PRODUCT_KINDS } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import { sectionTitle } from "../../theme";
import { BrandPackagesCard, StorePlansCard, TopupCard } from "./pricing-products";
import type { AdProduct } from "./types";
import { errorMessage } from "./utils";

const { Text } = Typography;

const SLOT_COLUMNS = [
  { key: "STORE", label: "Store" },
  { key: "BRAND", label: "Brand" },
  { key: "PLATFORM", label: "Martly" },
] as const;

type SlotLimits = Record<string, Partial<Record<(typeof SLOT_COLUMNS)[number]["key"], number | null>>>;

interface PricingConfig {
  gstPercent: number;
  slotLimits: SlotLimits;
  freeRegenerations: number;
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
    const kept = Object.fromEntries(Object.entries(caps ?? {}).filter(([, n]) => typeof n === "number"));
    if (Object.keys(kept).length) cleaned[placement] = kept;
  }
  return cleaned;
}

function SlotLimitsCard() {
  return (
    <Card title="Slot limits" size="small" style={{ marginBottom: 16 }} extra={<Text type="secondary">Banners that can run at once per placement; empty means no cap</Text>}>
      <Row gutter={8} style={{ marginBottom: 8 }}>
        <Col span={9} />
        {SLOT_COLUMNS.map((c) => (
          <Col span={5} key={c.key}><Text strong>{c.label}</Text></Col>
        ))}
      </Row>
      {Object.entries(BannerPlacementLabels).map(([placement, label]) => (
        <Row gutter={8} key={placement} align="middle">
          <Col span={9}><Text>{label}</Text></Col>
          {SLOT_COLUMNS.map((c) => (
            <Col span={5} key={c.key}>
              <Form.Item name={["slotLimits", placement, c.key]} style={{ marginBottom: 8 }}>
                <InputNumber min={0} precision={0} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          ))}
        </Row>
      ))}
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
          <Form.Item name="freeRegenerations" label="Free AI redrafts per promotion" rules={[{ required: true }]}>
            <InputNumber min={0} precision={0} style={{ width: "100%" }} />
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
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>{sectionTitle(<TagsOutlined />, "Ad pricing")}</h2>
      <StorePlansCard products={ofKind((p) => p.kind === "STORE_PLAN")} patch={patch} />
      <TopupCard products={ofKind((p) => p.kind === "PROMOTION_TOPUP")} patch={patch} />
      <BrandPackagesCard products={ofKind((p) => BRAND_PRODUCT_KINDS.includes(p.kind))} patch={patch} />
      <Form form={form} layout="vertical">
        <SlotLimitsCard />
        <InvoiceCard />
      </Form>
      <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save</Button>
      <Text type="secondary" style={{ marginLeft: 12 }}>Price changes apply to new purchases only.</Text>
    </div>
  );
};
