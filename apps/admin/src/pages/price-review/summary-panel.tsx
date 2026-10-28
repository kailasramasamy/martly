import { Card, Col, Progress, Row, Space, Statistic, Tag, Typography, theme } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, EditOutlined, EyeInvisibleOutlined, FormOutlined } from "@ant-design/icons";
import type { PriceReviewOutcome } from "@martly/shared/constants";
import type { PriceReviewSummary } from "@martly/shared/types";
import type { ItemFilters } from "./api";

type CardKey = "pending" | PriceReviewOutcome | "notCarried" | "mrp";

const TILES = [
  { key: "pending", title: "Pending", icon: <ClockCircleOutlined />, color: "#d97706", value: (s: PriceReviewSummary) => s.pending },
  { key: "KEPT", title: "Kept", icon: <CheckCircleOutlined />, color: "#16a34a", value: (s: PriceReviewSummary) => s.kept },
  { key: "CHANGED", title: "Changed", icon: <EditOutlined />, color: "#2563eb", value: (s: PriceReviewSummary) => s.changed },
  { key: "notCarried", title: "Not sold", icon: <EyeInvisibleOutlined />, color: "#dc2626", value: (s: PriceReviewSummary) => s.notCarried },
  { key: "mrp", title: "MRP corrected", icon: <FormOutlined />, color: "#0d9488", value: (s: PriceReviewSummary) => s.mrpCorrected },
] as const;

const count = (n: number) => n.toLocaleString("en-IN");

const activeCard = (f: ItemFilters): CardKey | null => {
  if (f.outcome) return f.outcome;
  if (f.status === "notCarried") return "notCarried";
  return f.status === "pending" ? "pending" : null;
};

interface Props {
  summary: PriceReviewSummary | null;
  filters: ItemFilters;
  onFilters: (change: Partial<ItemFilters>) => void;
}

/** Progress, clickable counts and the department strip; clicking narrows the product list */
export const SummaryPanel = ({ summary, filters, onFilters }: Props) => {
  const { token } = theme.useToken();
  const active = activeCard(filters);
  const pct = summary && summary.total ? Math.round((summary.reviewed / summary.total) * 100) : 0;

  const pick = (key: CardKey) => {
    if (key === "mrp") return;
    if (key === "pending" || key === "notCarried") onFilters({ status: key, outcome: undefined });
    else onFilters({ status: "reviewed", outcome: key });
  };

  return (
    <>
      <Card size="small" loading={!summary} style={{ marginBottom: 12 }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Typography.Text strong>{count(summary?.reviewed ?? 0)} of {count(summary?.total ?? 0)} reviewed · {pct}%</Typography.Text>
          <Space>
            {!!summary?.reviewedToday && <Tag color="green">+{count(summary.reviewedToday)} today</Tag>}
            {!!summary?.topSellersPending && <Tag color="gold">Top sellers pending: {count(summary.topSellersPending)}</Tag>}
          </Space>
        </Space>
        <Progress percent={pct} showInfo={false} strokeColor={token.colorPrimary} />
      </Card>

      <Row gutter={[12, 12]} style={{ marginBottom: 12 }}>
        {TILES.map((t) => (
          <Col key={t.key} xs={12} md={8} xl={{ flex: "20%" }}>
            <Card
              size="small"
              loading={!summary}
              hoverable={t.key !== "mrp"}
              onClick={() => pick(t.key)}
              style={{ borderColor: active === t.key ? t.color : undefined, boxShadow: active === t.key ? `0 0 0 1px ${t.color}` : undefined }}
            >
              <Statistic title={t.title} value={summary ? t.value(summary) : 0} prefix={t.icon} valueStyle={{ color: t.color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>

      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 }}>
        {summary?.departments.map((d) => {
          const on = filters.departmentId === d.id;
          return (
            <Card
              key={d.id}
              size="small"
              hoverable
              styles={{ body: { padding: "6px 12px", width: 160 } }}
              style={{ flex: "0 0 auto", borderColor: on ? token.colorPrimary : undefined, boxShadow: on ? `0 0 0 1px ${token.colorPrimary}` : undefined }}
              onClick={() => onFilters({ departmentId: on ? undefined : d.id })}
            >
              <Typography.Text style={{ fontSize: 13 }} ellipsis>{d.name}</Typography.Text>
              <Progress size="small" showInfo={false} percent={d.total ? Math.round(((d.total - d.pending) / d.total) * 100) : 100} />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>{d.pending === 0 ? "All checked" : `${count(d.pending)} pending`}</Typography.Text>
            </Card>
          );
        })}
      </div>
    </>
  );
};
