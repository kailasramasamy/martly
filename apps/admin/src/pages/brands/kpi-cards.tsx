import type { ReactNode } from "react";
import { Card, Col, Row, Statistic } from "antd";
import {
  TagsOutlined,
  ShopOutlined,
  PictureOutlined,
  InboxOutlined,
  PlusCircleOutlined,
} from "@ant-design/icons";
import type { BrandSegment, BrandSummary } from "@martly/shared/types";

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

interface Props {
  summary: BrandSummary | null;
  segment: BrandSegment | null;
  /** null shows every brand (the "Total brands" card) */
  onSegment: (segment: BrandSegment | null) => void;
}

// Clicking a card lists its brands; clicking the active card (or the total) goes back to all
export const BrandKpiCards = ({ summary, segment, onSegment }: Props) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
    {TILES.map((t) => {
      const target = t.key === "total" ? null : t.key;
      const active = segment === target;
      return (
        <Col key={t.key} xs={12} md={8} xl={{ flex: "20%" }}>
          <Card
            size="small"
            loading={summary === null}
            hoverable
            onClick={() => onSegment(active ? null : target)}
            style={{ borderColor: active ? t.color : undefined, boxShadow: active ? `0 0 0 1px ${t.color}` : undefined }}
          >
            <Statistic
              title={t.title}
              value={summary?.[t.key] ?? 0}
              prefix={t.icon}
              valueStyle={{ color: t.color, fontSize: 22 }}
            />
          </Card>
        </Col>
      );
    })}
  </Row>
);
