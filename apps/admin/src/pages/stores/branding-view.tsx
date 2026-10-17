import { Card, Col, Descriptions, Image, Row, Space, Tag, Typography } from "antd";
import { BgColorsOutlined } from "@ant-design/icons";
import { sectionTitle } from "../../theme";

export interface StoreBrandingRecord {
  imageUrl?: string | null;
  logoUrl?: string | null;
  brandColor?: string | null;
  tagline?: string | null;
  offerText?: string | null;
  highlights?: string[];
  promoImages?: string[];
  translations?: Record<string, { tagline?: string; offerText?: string }> | null;
}

const empty = <Typography.Text type="secondary">Not set</Typography.Text>;

function Text({ en, ta }: { en?: string | null; ta?: string }) {
  if (!en && !ta) return empty;
  return (
    <Space direction="vertical" size={0}>
      {en && <span>{en}</span>}
      {ta && <Typography.Text type="secondary">{ta}</Typography.Text>}
    </Space>
  );
}

/** Read-only view of what shoppers see when choosing this store */
export function BrandingView({ record }: { record: StoreBrandingRecord }) {
  const ta = record.translations?.ta;
  const posters = record.promoImages ?? [];
  return (
    <Card title={sectionTitle(<BgColorsOutlined />, "Storefront Branding")} size="small">
      <Row gutter={[16, 16]}>
        <Col xs={24} md={8}>
          <Typography.Text type="secondary">Cover photo</Typography.Text>
          <div style={{ marginTop: 6 }}>{record.imageUrl ? <Image src={record.imageUrl} style={{ width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 8 }} /> : empty}</div>
        </Col>
        <Col xs={24} md={4}>
          <Typography.Text type="secondary">Logo</Typography.Text>
          <div style={{ marginTop: 6 }}>{record.logoUrl ? <Image src={record.logoUrl} width={120} style={{ maxHeight: 120, objectFit: "contain" }} /> : empty}</div>
        </Col>
        <Col xs={24} md={12}>
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="Brand colour">
              {record.brandColor ? <Space><span style={{ display: "inline-block", width: 16, height: 16, borderRadius: 4, background: record.brandColor }} />{record.brandColor}</Space> : empty}
            </Descriptions.Item>
            <Descriptions.Item label="Tagline"><Text en={record.tagline} ta={ta?.tagline} /></Descriptions.Item>
            <Descriptions.Item label="Offer line"><Text en={record.offerText} ta={ta?.offerText} /></Descriptions.Item>
            <Descriptions.Item label="Highlights">{record.highlights?.length ? record.highlights.map((h) => <Tag key={h}>{h}</Tag>) : empty}</Descriptions.Item>
          </Descriptions>
        </Col>
        <Col xs={24}>
          <Typography.Text type="secondary">Promo posters</Typography.Text>
          <div style={{ marginTop: 6 }}>
            {posters.length ? (
              <Image.PreviewGroup>
                <Space wrap>{posters.map((p) => <Image key={p} src={p} width={160} height={160} style={{ objectFit: "cover", borderRadius: 8 }} />)}</Space>
              </Image.PreviewGroup>
            ) : empty}
          </div>
        </Col>
      </Row>
    </Card>
  );
}
