import { useCallback, useEffect, useState } from "react";
import { App, Alert, Card, Space, Switch, Table, Tag, Typography } from "antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { errorMessage } from "./utils";
import { ReadableSection } from "../../components/ReadableSection";
import { BRAND_CAMPAIGN_STATUS_COLORS } from "../../constants/tag-colors";
import { BrandLogo } from "../brands/brand-parts";

const { Paragraph, Text } = Typography;

interface BrandRef { id: string; name: string; imageUrl: string | null }

interface BrandAdCampaign {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  discountType: "PERCENTAGE" | "FLAT" | null;
  discountValue: number | null;
  packageName: string;
  brand: BrandRef;
}

interface BrandSettings {
  boostOwnBrands: boolean;
  featuredBrands: BrandRef[];
}

function discountText(c: BrandAdCampaign): string {
  if (!c.discountType || c.discountValue === null) return "—";
  return c.discountType === "PERCENTAGE" ? `${c.discountValue}% off` : `₹${c.discountValue.toLocaleString("en-IN")} off`;
}

function useBrandAds() {
  const { notification } = App.useApp();
  const [settings, setSettings] = useState<BrandSettings>({ boostOwnBrands: true, featuredBrands: [] });
  const [campaigns, setCampaigns] = useState<BrandAdCampaign[]>([]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [settings, list] = await Promise.all([axiosInstance.get("/marketing/brand-ads"), axiosInstance.get("/marketing/brand-ads/campaigns")]);
      setSettings(settings.data.data);
      setCampaigns(list.data.data);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not load brand ads") });
    }
  }, [notification]);

  useEffect(() => { void load(); }, [load]);

  const setBoostOwnBrands = async (boostOwnBrands: boolean) => {
    setSaving(true);
    try {
      await axiosInstance.put("/marketing/brand-ads", { boostOwnBrands });
      setSettings((prev) => ({ ...prev, boostOwnBrands }));
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save") });
    } finally {
      setSaving(false);
    }
  };

  return { settings, campaigns, saving, setBoostOwnBrands };
}

const brandCell = (brand: BrandRef) => <Space><BrandLogo brand={brand} height={24} />{brand.name}</Space>;

export function BrandAdsTab({ canEdit }: { canEdit: boolean }) {
  const { settings, campaigns, saving, setBoostOwnBrands } = useBrandAds();
  const columns = [
    { title: "Brand", render: (_: unknown, c: BrandAdCampaign) => brandCell(c.brand) },
    { title: "Campaign", dataIndex: "title" },
    { title: "Package", dataIndex: "packageName" },
    { title: "Status", dataIndex: "status", render: (v: string) => <Tag color={BRAND_CAMPAIGN_STATUS_COLORS[v]}>{v.replace("_", " ")}</Tag> },
    { title: "Runs", render: (_: unknown, c: BrandAdCampaign) => `${dayjs(c.startsAt).format("D MMM")} – ${dayjs(c.endsAt).format("D MMM")}` },
    { title: "Discount", render: (_: unknown, c: BrandAdCampaign) => discountText(c) },
  ];
  return (
    <>
      <ReadableSection>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Brand ads are booked by Martly and run in your stores for the brands you stock. They help your sales."
        />
        <Card size="small" title="Brands you promote" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space>
              <Switch checked={settings.boostOwnBrands} disabled={!canEdit} loading={saving} onChange={(v) => void setBoostOwnBrands(v)} />
              <Text>Promote my own brands</Text>
            </Space>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Your own brand and unbranded staples (rice, dal, flour…) lead search and category pages, marked "Our brand".
            </Paragraph>
            <Text strong>Featured by Martly</Text>
            {settings.featuredBrands.length === 0 ? (
              <Text type="secondary">None right now</Text>
            ) : (
              <Space wrap size="middle">{settings.featuredBrands.map((b) => <span key={b.id}>{brandCell(b)}</span>)}</Space>
            )}
          </Space>
        </Card>
      </ReadableSection>
      <Card size="small" title="Upcoming and running brand campaigns">
        <Table size="small" rowKey="id" dataSource={campaigns} columns={columns} pagination={{ pageSize: 10 }} />
      </Card>
    </>
  );
}
