import { Show } from "@refinedev/antd";
import { useOne, useShow } from "@refinedev/core";
import { Card, Col, Descriptions, Image, Row, Statistic, Tag, Typography } from "antd";
import { Link } from "react-router";
import dayjs from "dayjs";
import { BannerActionTypeLabels, SponsorTypeLabels, type BannerActionType, type SponsorType } from "@martly/shared/constants";
import { BANNER_PLACEMENT_CONFIG } from "../../constants/tag-colors";
import { pathLabel, useCategoryTree } from "./category-target";

interface BannerRecord {
  id: string; title: string; subtitle: string | null; imageUrl: string; imageUrls: Record<string, string> | null; textInImage: boolean;
  placement: string; actionType: BannerActionType; actionTarget: string | null; sortOrder: number; isActive: boolean;
  startsAt: string | null; endsAt: string | null; sponsorType: SponsorType;
  organization: { name: string } | null; store: { name: string } | null; promo: { id: string; status: string } | null;
  stats: { days: number; views: number; taps: number; ctr: number };
}

const RESOURCE_OF: Partial<Record<BannerActionType, string>> = { PRODUCT: "products", COLLECTION: "collections", BRAND: "brands" };

/** Where tapping the banner goes, by name rather than id */
function TargetLabel({ type, target }: { type: BannerActionType; target: string | null }) {
  const tree = useCategoryTree();
  const resource = RESOURCE_OF[type];
  const { data } = useOne({ resource: resource ?? "products", id: target ?? "", queryOptions: { enabled: !!resource && !!target } });
  if (!target || type === "NONE") return <>—</>;
  if (type === "CATEGORY") return <>{pathLabel(tree, target) ?? target}</>;
  if (type === "URL") return <a href={target} target="_blank" rel="noreferrer">{target}</a>;
  if (resource) return <>{(data?.data?.name ?? data?.data?.title ?? target) as string}</>;
  return <>{target}</>;
}

function Artwork({ banner }: { banner: BannerRecord }) {
  const images = banner.imageUrls ?? { en: banner.imageUrl };
  return (
    <Card title="Artwork" size="small" style={{ marginBottom: 16 }}>
      <Image.PreviewGroup>
        <Row gutter={12}>
          {Object.entries(images).map(([lang, url]) => (
            <Col key={lang} xs={24} md={12}>
              <Image src={url} style={{ width: "100%", borderRadius: 12 }} />
              <Typography.Text type="secondary">{lang === "ta" ? "Tamil" : lang === "en" ? "English" : lang}</Typography.Text>
            </Col>
          ))}
        </Row>
      </Image.PreviewGroup>
      <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0 }}>
        {banner.textInImage ? "The title is part of the artwork." : "The app shows the title below the artwork."}
      </Typography.Paragraph>
    </Card>
  );
}

function Details({ banner }: { banner: BannerRecord }) {
  const placement = BANNER_PLACEMENT_CONFIG[banner.placement];
  const when = (d: string | null, fallback: string) => (d ? dayjs(d).format("D MMM YYYY, h:mm A") : fallback);
  return (
    <Card title="Details" size="small" style={{ marginBottom: 16 }}>
      <Descriptions column={1} size="small" styles={{ label: { width: 130 } }}>
        <Descriptions.Item label="Title">{banner.title}</Descriptions.Item>
        <Descriptions.Item label="Subtitle">{banner.subtitle || "—"}</Descriptions.Item>
        <Descriptions.Item label="Placement">{placement ? <Tag color={placement.color}>{placement.label}</Tag> : banner.placement}</Descriptions.Item>
        <Descriptions.Item label="Opens">{BannerActionTypeLabels[banner.actionType]}: <TargetLabel type={banner.actionType} target={banner.actionTarget} /></Descriptions.Item>
        <Descriptions.Item label="Shown in">{banner.store?.name ?? banner.organization?.name ?? "Every store"}</Descriptions.Item>
        <Descriptions.Item label="Sponsor">{SponsorTypeLabels[banner.sponsorType]}</Descriptions.Item>
        <Descriptions.Item label="Status">{banner.isActive ? <Tag color="green">Active</Tag> : <Tag>Off</Tag>}</Descriptions.Item>
        <Descriptions.Item label="Runs">{when(banner.startsAt, "Now")} → {when(banner.endsAt, "No end date")}</Descriptions.Item>
        <Descriptions.Item label="Sort order">{banner.sortOrder}</Descriptions.Item>
        {banner.promo && <Descriptions.Item label="Promotion"><Link to={`/promos/show/${banner.promo.id}`}>Open the promotion</Link></Descriptions.Item>}
      </Descriptions>
    </Card>
  );
}

export const BannerShow = () => {
  const { query } = useShow<BannerRecord>({ resource: "banners" });
  const banner = query.data?.data;
  // Promotions and brand campaigns own their banners; those are changed from there
  const owned = !!banner?.promo || banner?.sponsorType === "BRAND";
  return (
    <Show isLoading={query.isLoading} canEdit={!owned} canDelete={!owned} title={banner?.title ?? "Banner"}>
      {banner && (
        <Row gutter={16}>
          <Col xs={24} lg={14}><Artwork banner={banner} /></Col>
          <Col xs={24} lg={10}>
            <Card title={`Last ${banner.stats.days} days`} size="small" style={{ marginBottom: 16 }}>
              <Row gutter={12}>
                <Col span={8}><Statistic title="Views" value={banner.stats.views} /></Col>
                <Col span={8}><Statistic title="Taps" value={banner.stats.taps} /></Col>
                <Col span={8}><Statistic title="Tap rate" value={banner.stats.ctr} suffix="%" /></Col>
              </Row>
            </Card>
            <Details banner={banner} />
          </Col>
        </Row>
      )}
    </Show>
  );
};
