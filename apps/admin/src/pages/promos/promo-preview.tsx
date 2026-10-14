import { Card, Image, List, Space, Tag, Timeline, Typography, Spin } from "antd";
import { BulbOutlined, PictureOutlined, BellOutlined, LoadingOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { PromoDetail } from "@martly/shared/types";
import { sectionTitle } from "../../theme";

const { Text, Title } = Typography;
const BANNER_WIDTH = 320;
const LANGUAGE_LABELS: Record<string, string> = { en: "English", ta: "Tamil", art: "Artwork" };

export function DraftingProgress({ log }: { log: PromoDetail["log"] }) {
  return (
    <Card size="small">
      <Space style={{ marginBottom: 16 }}>
        <Spin indicator={<LoadingOutlined spin />} />
        <Text>Drafting&hellip; usually about a minute</Text>
      </Space>
      <Timeline
        items={log.map((entry, i) => ({
          color: i === log.length - 1 ? "blue" : "green",
          children: `${dayjs(entry.at).format("h:mm:ss A")}  ${entry.message}`,
        }))}
      />
    </Card>
  );
}

function BannerImages({ images }: { images: Record<string, string> }) {
  return (
    <Space size={16} wrap align="start">
      {Object.entries(images).map(([lang, url]) => (
        <Space key={lang} direction="vertical" size={4}>
          <Tag>{LANGUAGE_LABELS[lang] ?? lang}</Tag>
          <Image src={url} width={BANNER_WIDTH} style={{ aspectRatio: "3 / 2", objectFit: "cover", borderRadius: 8 }} />
        </Space>
      ))}
    </Space>
  );
}

function CopyAndPush({ promo }: { promo: PromoDetail }) {
  return (
    <Space direction="vertical" size={8} style={{ width: "100%", marginTop: 16 }}>
      {Object.entries(promo.copy ?? {}).map(([lang, c]) => (
        <div key={lang}>
          <Tag>{LANGUAGE_LABELS[lang] ?? lang}</Tag>
          <Text strong>{c.title}</Text>
          <Text type="secondary"> {c.subtitle}</Text>
        </div>
      ))}
      {promo.push && (
        <div>
          <Text type="secondary"><BellOutlined /> Push preview</Text>
          <Title level={5} style={{ margin: 0 }}>{promo.push.title}</Title>
          <Text>{promo.push.body}</Text>
        </div>
      )}
      {promo.pushSent && <Text type="success">Push sent to {promo.pushSent.recipients.toLocaleString("en-IN")} customers</Text>}
    </Space>
  );
}

export function PromoPreview({ promo }: { promo: PromoDetail }) {
  return (
    <>
      <Card title={sectionTitle(<PictureOutlined />, "Banner and message")} size="small" style={{ marginBottom: 16 }}>
        {promo.images && <BannerImages images={promo.images} />}
        <CopyAndPush promo={promo} />
      </Card>
      {promo.assumptions.length > 0 && (
        <Card title={sectionTitle(<BulbOutlined />, "Assumptions")} size="small" style={{ marginBottom: 16 }}>
          <List size="small" dataSource={promo.assumptions} renderItem={(a) => <List.Item>{a}</List.Item>} />
        </Card>
      )}
    </>
  );
}
