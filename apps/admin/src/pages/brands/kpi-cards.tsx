import type { ReactNode } from "react";
import { Card, Col, Row, Statistic } from "antd";
import {
  TagsOutlined,
  ShopOutlined,
  PictureOutlined,
  InboxOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";
import type { BrandSummary } from "@martly/shared/types";

interface Tile {
  key: keyof BrandSummary;
  title: string;
  icon: ReactNode;
  color: string;
}

const TILES: Tile[] = [
  { key: "total", title: "Total brands", icon: <TagsOutlined />, color: "#0d9488" },
  { key: "brandStores", title: "Brand stores", icon: <ShopOutlined />, color: "#2563eb" },
  { key: "addedLast30d", title: "Added in 30 days", icon: <PlusCircleOutlined />, color: "#16a34a" },
  { key: "withoutLogo", title: "Missing logo", icon: <PictureOutlined />, color: "#d97706" },
  { key: "withoutProducts", title: "No products", icon: <InboxOutlined />, color: "#dc2626" },
];

export const BrandKpiCards = ({ summary }: { summary: BrandSummary | null }) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
    {TILES.map((t) => (
      <Col key={t.key} xs={12} md={8} xl={{ flex: "20%" }}>
        <Card size="small" loading={summary === null}>
          <Statistic
            title={t.title}
            value={summary?.[t.key] ?? 0}
            prefix={t.icon}
            valueStyle={{ color: t.color, fontSize: 22 }}
          />
        </Card>
      </Col>
    ))}
  </Row>
);
