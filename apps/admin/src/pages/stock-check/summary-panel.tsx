import { Card, Col, Progress, Row, Space, Statistic, Tag, Typography, theme } from "antd";
import { CheckCircleOutlined, ClockCircleOutlined, EyeInvisibleOutlined, StopOutlined } from "@ant-design/icons";
import type { StockCheckSummary } from "@martly/shared/types";
import { count } from "./api";

export type DepartmentFocus = "carried" | "notCarried";

const TILES = [
  { title: "Carried", focus: "carried", icon: <CheckCircleOutlined />, color: "#16a34a", value: (s: StockCheckSummary) => s.carried },
  { title: "Not sold", focus: "notCarried", icon: <StopOutlined />, color: "#dc2626", value: (s: StockCheckSummary) => s.notCarried },
  { title: "To confirm", icon: <ClockCircleOutlined />, color: "#d97706", value: (s: StockCheckSummary) => s.unchecked },
  { title: "Hidden suggestions", icon: <EyeInvisibleOutlined />, color: "#2563eb", value: (s: StockCheckSummary) => s.suggested },
] as const;

interface Props {
  summary: StockCheckSummary | null;
  focus: DepartmentFocus | null;
  /** Carried and Not sold narrow the departments to those that have some */
  onFocus: (focus: DepartmentFocus | null) => void;
}

/** How much of the store's range is confirmed, and what is left */
export const SummaryPanel = ({ summary, focus, onFocus }: Props) => {
  const { token } = theme.useToken();
  const confirmed = summary ? summary.carried + summary.notCarried : 0;
  const pct = summary && summary.total ? Math.round((confirmed / summary.total) * 100) : 0;

  return (
    <>
      <Card size="small" loading={!summary} style={{ marginBottom: 12 }}>
        <Space style={{ width: "100%", justifyContent: "space-between" }} wrap>
          <Typography.Text strong>{count(confirmed)} of {count(summary?.total ?? 0)} confirmed · {pct}%</Typography.Text>
          {!!summary?.checkedToday && <Tag color="green">+{count(summary.checkedToday)} today</Tag>}
        </Space>
        <Progress percent={pct} showInfo={false} strokeColor={token.colorPrimary} />
      </Card>
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        {TILES.map((t) => (
          <Col key={t.title} xs={12} xl={6}>
            <Card
              size="small"
              loading={!summary}
              hoverable={"focus" in t && !!summary && t.value(summary) > 0}
              onClick={"focus" in t && summary && t.value(summary) > 0 ? () => onFocus(focus === t.focus ? null : t.focus) : undefined}
              style={"focus" in t && focus === t.focus ? { borderColor: t.color } : undefined}
            >
              <Statistic title={t.title} value={summary ? t.value(summary) : 0} prefix={t.icon} valueStyle={{ color: t.color, fontSize: 22 }} />
            </Card>
          </Col>
        ))}
      </Row>
    </>
  );
};
