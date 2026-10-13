import type { ReactNode } from "react";
import { Card, Col, Row, Statistic } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CalendarOutlined,
  StopOutlined,
  FieldTimeOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";

export interface FestivalSummary {
  total: number;
  live: number;
  upcoming30d: number;
  curated: number;
  awaitingGoLive: number;
  vetoed: number;
}

interface Tile {
  key: keyof FestivalSummary;
  title: string;
  icon: ReactNode;
  color: string;
}

const TILES: Tile[] = [
  { key: "live", title: "Live now", icon: <PlayCircleOutlined />, color: "#16a34a" },
  { key: "upcoming30d", title: "Starting in 30 days", icon: <CalendarOutlined />, color: "#2563eb" },
  { key: "curated", title: "Curated", icon: <CheckCircleOutlined />, color: "#0d9488" },
  { key: "awaitingGoLive", title: "Awaiting go-live", icon: <FieldTimeOutlined />, color: "#d97706" },
  { key: "vetoed", title: "Vetoed", icon: <StopOutlined />, color: "#dc2626" },
  { key: "total", title: "Total events", icon: <ClockCircleOutlined />, color: "#64748b" },
];

export const FestivalKpiCards = ({ summary }: { summary: FestivalSummary | null }) => (
  <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
    {TILES.map((t) => (
      <Col key={t.key} xs={12} md={8} xl={4}>
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
