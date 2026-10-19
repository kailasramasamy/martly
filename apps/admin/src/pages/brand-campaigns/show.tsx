import { useCallback, useEffect, useState } from "react";
import { App, Alert, Button, Card, Descriptions, Image, Space, Spin, Typography } from "antd";
import { Show } from "@refinedev/antd";
import { useNavigate, useParams } from "react-router";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import { errorMessage, invoiceHref } from "../marketing/utils";
import { CampaignActions } from "./campaign-actions";
import { CampaignResults } from "./campaign-results";
import { CampaignStatusTag } from "./list";
import { EDITABLE_STATUSES, type Campaign, type CampaignScope } from "./types";
import { ReadableSection } from "../../components/ReadableSection";

const ART_TIMEOUT_MS = 120000;
const date = (v: string) => dayjs(v).format("D MMM YYYY");

interface SponsoredItem { name: string; imageUrl: string | null }

function SponsoredCard({ campaign }: { campaign: Campaign }) {
  const [item, setItem] = useState<SponsoredItem | null>(null);
  useEffect(() => {
    axiosInstance.get(`/products/${campaign.actionTarget}`).then((res) => setItem(res.data.data));
  }, [campaign.actionTarget]);

  return (
    <Card title="Sponsored product" size="small" style={{ marginBottom: 16 }}>
      {item ? (
        <Space align="center">
          <Image src={item.imageUrl ?? campaign.imageUrl ?? undefined} width={96} style={{ borderRadius: 8 }} />
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{item.name}</Typography.Text>
            <Typography.Text type="secondary">Shows in: {campaign.category?.name ?? "—"}</Typography.Text>
          </Space>
        </Space>
      ) : <Spin />}
    </Card>
  );
}

function CreativeCard({ campaign, scope, onChange }: { campaign: Campaign; scope: CampaignScope; onChange: (c: Campaign) => void }) {
  const { notification } = App.useApp();
  const [generating, setGenerating] = useState(false);
  const canGenerate = EDITABLE_STATUSES.includes(campaign.status) && !!campaign.brief;
  const poster = campaign.placement === "HOME_POSTER";

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await axiosInstance.post(`${scope.apiBase}/${campaign.id}/generate-art`, null, { timeout: ART_TIMEOUT_MS });
      onChange(res.data.data);
    } catch (err) {
      notification.error({ message: errorMessage(err, "Could not generate the banner") });
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card title={poster ? "Poster" : "Banner"} size="small" style={{ marginBottom: 16 }}>
      <Space direction="vertical">
        {campaign.imageUrl ? <Image src={campaign.imageUrl} width={poster ? 240 : 360} style={{ aspectRatio: poster ? "2 / 3" : "3 / 2", objectFit: "cover", borderRadius: 8 }} /> : <Typography.Text type="secondary">No {poster ? "poster" : "banner"} yet</Typography.Text>}
        {canGenerate && (
          <Button loading={generating} onClick={generate}>{campaign.imageUrl ? "Regenerate" : "Generate"}{poster ? " poster" : " banner"}</Button>
        )}
        {generating && <Typography.Text type="secondary">Designing your banner… up to a minute or two</Typography.Text>}
        <Typography.Text strong>{campaign.title}</Typography.Text>
        {campaign.subtitle && <Typography.Text>{campaign.subtitle}</Typography.Text>}
      </Space>
    </Card>
  );
}

function DetailsCard({ campaign, platform }: { campaign: Campaign; platform: boolean }) {
  const order = campaign.adOrder;
  const unit = campaign.product.kind === "BRAND_CPM" ? "thousand views" : "week(s)";
  return (
    <Card title="Details" size="small" style={{ marginBottom: 16 }}>
      <Descriptions size="small" column={1}>
        {platform && <Descriptions.Item label="Brand">{campaign.brand.name}</Descriptions.Item>}
        <Descriptions.Item label="Package">{campaign.product.name} × {campaign.quantity} {unit}</Descriptions.Item>
        <Descriptions.Item label="Runs">{date(campaign.startsAt)} – {date(campaign.endsAt)}</Descriptions.Item>
        {campaign.category && <Descriptions.Item label="Category">{campaign.category.name}</Descriptions.Item>}
        {campaign.discountType && (
          <Descriptions.Item label="Discount">{campaign.discountType === "PERCENTAGE" ? `${campaign.discountValue}% off` : `${formatRupees(campaign.discountValue ?? 0)} off`}</Descriptions.Item>
        )}
        <Descriptions.Item label="Price">{formatRupees(campaign.product.price * campaign.quantity)} + GST</Descriptions.Item>
        {order && (
          <Descriptions.Item label="Order">
            {order.number ?? "Pending"} · {formatRupees(order.total)} · {order.status}
            {order.invoiceUrl && <> · <a href={invoiceHref(order.invoiceUrl)} target="_blank" rel="noreferrer">Invoice</a></>}
          </Descriptions.Item>
        )}
      </Descriptions>
    </Card>
  );
}

export function CampaignShow({ scope }: { scope: CampaignScope }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  const load = useCallback(() => axiosInstance.get(`${scope.apiBase}/${id}`).then((res) => setCampaign(res.data.data)), [scope.apiBase, id]);
  useEffect(() => { void load(); }, [load]);

  if (!campaign) return <Spin style={{ display: "block", margin: "64px auto" }} />;

  return (
    <Show
      title={campaign.title}
      canDelete={false}
      canEdit={false}
      headerButtons={() => (
        <Space>
          {EDITABLE_STATUSES.includes(campaign.status) && <Button onClick={() => navigate(`${scope.path}/edit/${campaign.id}`)}>Edit</Button>}
          <CampaignActions campaign={campaign} scope={scope} onChange={setCampaign} />
        </Space>
      )}
    >
      <ReadableSection>
        <Space style={{ marginBottom: 16 }}><CampaignStatusTag status={campaign.status} /></Space>
        {campaign.reviewNote && <Alert type={campaign.status === "REJECTED" ? "error" : "info"} showIcon message={campaign.reviewNote} style={{ marginBottom: 16 }} />}
        {campaign.placement === "SPONSORED_PRODUCT"
          ? <SponsoredCard campaign={campaign} />
          : <CreativeCard campaign={campaign} scope={scope} onChange={setCampaign} />}
        <DetailsCard campaign={campaign} platform={scope.mode === "platform"} />
        {campaign.results && (
          <Card title="Results" size="small"><CampaignResults results={campaign.results} /></Card>
        )}
      </ReadableSection>
    </Show>
  );
}
