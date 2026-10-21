import { useCallback, useEffect, useState } from "react";
import { App, Alert, Avatar, Button, Card, Select, Space, Switch, Table, Tag, Tooltip, Typography } from "antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { errorMessage } from "./utils";
import { ReadableSection } from "../../components/ReadableSection";

const { Paragraph, Text } = Typography;
const SEARCH_PAGE_SIZE = 20;

interface BrandRef { id: string; name: string; imageUrl: string | null }

interface BrandAdCampaign {
  id: string;
  title: string;
  status: string;
  startsAt: string;
  endsAt: string;
  discountType: "PERCENTAGE" | "FLAT" | null;
  discountValue: number | null;
  brand: BrandRef;
  optedOut: boolean;
}

interface BrandSettings {
  allowBrandAds: boolean;
  blockedBrands: BrandRef[];
  boostOwnBrands: boolean;
  featuredBrands: BrandRef[];
}

function BrandSearch({ value, placeholder, disabled, onChange }: { value: BrandRef[]; placeholder: string; disabled: boolean; onChange: (brands: BrandRef[]) => void }) {
  const [options, setOptions] = useState<BrandRef[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (q: string) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get("/brands", { params: { q, pageSize: SEARCH_PAGE_SIZE } });
      setOptions(res.data.data);
    } finally {
      setLoading(false);
    }
  };

  const known = new Map([...value, ...options].map((b) => [b.id, b]));
  return (
    <Select
      mode="multiple"
      showSearch
      filterOption={false}
      disabled={disabled}
      loading={loading}
      placeholder={placeholder}
      style={{ width: "100%" }}
      value={value.map((b) => b.id)}
      options={[...known.values()].map((b) => ({ value: b.id, label: b.name }))}
      onSearch={(q) => void search(q)}
      onChange={(ids: string[]) => onChange(ids.flatMap((id) => known.get(id) ?? []))}
    />
  );
}

function discountText(c: BrandAdCampaign): string {
  if (!c.discountType || c.discountValue === null) return "—";
  return c.discountType === "PERCENTAGE" ? `${c.discountValue}% off` : `₹${c.discountValue.toLocaleString("en-IN")} off`;
}

function useBrandAds() {
  const { notification } = App.useApp();
  const [settings, setSettings] = useState<BrandSettings>({ allowBrandAds: true, blockedBrands: [], boostOwnBrands: true, featuredBrands: [] });
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

  const save = async (patch: Partial<BrandSettings>) => {
    const next = { ...settings, ...patch };
    setSaving(true);
    try {
      await axiosInstance.put("/marketing/brand-ads", {
        allowBrandAds: next.allowBrandAds, blockedBrandIds: next.blockedBrands.map((b) => b.id),
        boostOwnBrands: next.boostOwnBrands, featuredBrandIds: next.featuredBrands.map((b) => b.id),
      });
      setSettings(next);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not save") });
    } finally {
      setSaving(false);
    }
  };

  const optOut = async (id: string, optedOut: boolean) => {
    try {
      await axiosInstance.put(`/marketing/brand-ads/campaigns/${id}/opt-out`, { optedOut });
      setCampaigns((prev) => prev.map((c) => (c.id === id ? { ...c, optedOut } : c)));
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not update the campaign") });
    }
  };

  return { settings, campaigns, saving, save, optOut };
}

export function BrandAdsTab({ canEdit }: { canEdit: boolean }) {
  const { settings, campaigns, saving, save, optOut } = useBrandAds();
  const columns = [
    { title: "Brand", render: (_: unknown, c: BrandAdCampaign) => <Space><Avatar src={c.brand.imageUrl} size="small">{c.brand.name[0]}</Avatar>{c.brand.name}</Space> },
    { title: "Campaign", dataIndex: "title" },
    { title: "Status", dataIndex: "status", render: (v: string) => <Tag>{v.replace("_", " ")}</Tag> },
    { title: "Runs", render: (_: unknown, c: BrandAdCampaign) => `${dayjs(c.startsAt).format("D MMM")} – ${dayjs(c.endsAt).format("D MMM")}` },
    { title: "Discount", render: (_: unknown, c: BrandAdCampaign) => discountText(c) },
    {
      title: "Opt out",
      render: (_: unknown, c: BrandAdCampaign) => (
        <Tooltip title={c.status !== "SCHEDULED" ? "You can opt out only before a campaign starts" : canEdit ? undefined : "Only the owner can change this"}>
          <Switch checked={c.optedOut} disabled={!canEdit || c.status !== "SCHEDULED"} onChange={(v) => void optOut(c.id, v)} />
        </Tooltip>
      ),
    },
  ];
  return (
    <>
      <ReadableSection>
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Brand ads appear in your stores only for brands you stock. Block any brand you don't want. A brand promotion lowers prices on that brand in your stores and the brand reimburses the discount (claims report). You can opt out of a campaign before it starts."
        />
        <Card size="small" title="Brand ads in my stores" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Space>
              <Switch checked={settings.allowBrandAds} disabled={!canEdit} loading={saving} onChange={(v) => void save({ allowBrandAds: v })} />
              <Text>Show brand ads in my stores</Text>
            </Space>
            <Paragraph type="secondary" style={{ margin: 0 }}>Blocked brands</Paragraph>
            <BrandSearch value={settings.blockedBrands} placeholder="Search brands to block" disabled={!canEdit || saving} onChange={(next) => void save({ blockedBrands: next })} />
          </Space>
        </Card>
        <Card size="small" title="Brands you promote" style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: "100%" }}>
            <Paragraph type="secondary" style={{ margin: 0 }}>
              Your own brands and featured brands come first in search, category pages and voice or list orders, marked "Our brand" or "Featured" for shoppers.
            </Paragraph>
            <Space>
              <Switch checked={settings.boostOwnBrands} disabled={!canEdit} loading={saving} onChange={(v) => void save({ boostOwnBrands: v })} />
              <Text>Promote my own brands</Text>
            </Space>
            <Paragraph type="secondary" style={{ margin: 0 }}>Featured brands</Paragraph>
            <BrandSearch value={settings.featuredBrands} placeholder="Search brands to feature" disabled={!canEdit || saving} onChange={(next) => void save({ featuredBrands: next })} />
          </Space>
        </Card>
      </ReadableSection>
      <Card size="small" title="Upcoming and running brand campaigns">
        <Table size="small" rowKey="id" dataSource={campaigns} columns={columns} pagination={{ pageSize: 10 }} />
      </Card>
    </>
  );
}
