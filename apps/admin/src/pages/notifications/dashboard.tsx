import { useCallback, useEffect, useState } from "react";
import { Card, Col, Row, Segmented, Spin, Statistic, Table, Tag, Typography, theme as antTheme } from "antd";
import {
  SendOutlined,
  NotificationOutlined,
  EyeOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

import { axiosInstance } from "../../providers/data-provider";
import { BRAND, sectionTitle } from "../../theme";
import {
  NOTIFICATION_TYPE_CONFIG,
  CAMPAIGN_STATUS_CONFIG,
  AUDIENCE_TYPE_CONFIG,
} from "../../constants/tag-colors";

/* ── Types ─────────────────────────────────────────────── */
interface KPIs {
  campaignsSent: number;
  notificationsDelivered: number;
  readRate: number;
  avgRecipients: number;
}

interface DailyStat {
  date: string;
  campaigns: number;
  notifications: number;
}

interface ByType {
  type: string;
  count: number;
  notifications: number;
}

interface TopCampaign {
  id: string;
  title: string;
  type: string;
  audienceType: string;
  recipientCount: number;
  readCount: number;
  readRate: number;
  sentAt: string;
}

interface RecentCampaign {
  id: string;
  title: string;
  type: string;
  audienceType: string;
  status: string;
  recipientCount: number;
  sentAt: string;
  createdAt: string;
}

interface StatsData {
  kpis: KPIs;
  dailyStats: DailyStat[];
  byType: ByType[];
  topCampaigns: TopCampaign[];
  recentCampaigns: RecentCampaign[];
}

/* ── Main Component ───────────────────────────────────── */
export const NotificationDashboard = () => {
  const { token } = antTheme.useToken();
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(7);

  const fetchData = useCallback(async (period: number) => {
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/notifications/admin/stats?days=${period}`);
      setData(res.data?.data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  }, [days, fetchData]);

  if (loading && !data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, color: token.colorTextSecondary }}>
        Failed to load notification analytics.
      </div>
    );
  }

  const { kpis } = data;

  const kpiCards: {
    title: string;
    value: number;
    suffix?: string;
    icon: React.ReactNode;
    accent: string;
  }[] = [
    {
      title: "Campaigns Sent",
      value: kpis.campaignsSent,
      icon: <SendOutlined />,
      accent: BRAND.primary,
    },
    {
      title: "Notifications Delivered",
      value: kpis.notificationsDelivered,
      icon: <NotificationOutlined />,
      accent: BRAND.info,
    },
    {
      title: "Read Rate",
      value: kpis.readRate,
      suffix: "%",
      icon: <EyeOutlined />,
      accent: BRAND.success,
    },
    {
      title: "Avg Recipients",
      value: kpis.avgRecipients,
      icon: <TeamOutlined />,
      accent: BRAND.warning,
    },
  ];

  return (
    <div style={{ padding: "16px 24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: token.colorText, letterSpacing: -0.3 }}>
            Notification Analytics
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: token.colorTextTertiary }}>
            Campaign performance overview
          </p>
        </div>
        <Segmented
          value={days}
          onChange={(val) => setDays(val as number)}
          options={[
            { label: "7 days", value: 7 },
            { label: "30 days", value: 30 },
            { label: "90 days", value: 90 },
          ]}
          style={{ fontWeight: 500 }}
        />
      </div>

      <Spin spinning={loading}>
        {/* ── KPI Cards ─────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {kpiCards.map((kpi) => (
            <Col xs={24} sm={12} lg={6} key={kpi.title}>
              <Card
                style={{
                  borderRadius: 10,
                  border: `1px solid ${token.colorBorderSecondary}`,
                  overflow: "hidden",
                  position: "relative",
                }}
                styles={{ body: { padding: "20px 20px 16px" } }}
              >
                {/* Accent bar */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: 3,
                    background: `linear-gradient(90deg, ${kpi.accent}, ${kpi.accent}88)`,
                  }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <Statistic
                    title={
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: token.colorTextSecondary,
                          letterSpacing: 0.3,
                          textTransform: "uppercase",
                        }}
                      >
                        {kpi.title}
                      </span>
                    }
                    value={kpi.value}
                    suffix={kpi.suffix}
                    valueStyle={{
                      fontSize: 28,
                      fontWeight: 700,
                      color: token.colorText,
                      letterSpacing: -0.5,
                    }}
                  />
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 10,
                      background: `${kpi.accent}14`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 20,
                      color: kpi.accent,
                      flexShrink: 0,
                    }}
                  >
                    {kpi.icon}
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Data Tables Row ─────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {/* Sent Over Time */}
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<NotificationOutlined />, "Sent Over Time")}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "0 0 4px" } }}
            >
              <Table
                dataSource={data.dailyStats}
                rowKey="date"
                pagination={false}
                size="small"
                scroll={{ y: 300 }}
                locale={{ emptyText: "No data for this period" }}
                columns={[
                  {
                    title: "Date",
                    dataIndex: "date",
                    render: (d: string) => (
                      <span style={{ fontSize: 13 }}>{dayjs(d).format("DD MMM YYYY")}</span>
                    ),
                  },
                  {
                    title: "Campaigns",
                    dataIndex: "campaigns",
                    width: 100,
                    align: "right" as const,
                    render: (v: number) => (
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                    ),
                  },
                  {
                    title: "Notifications",
                    dataIndex: "notifications",
                    width: 120,
                    align: "right" as const,
                    render: (v: number) => (
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: BRAND.primary }}>
                        {v.toLocaleString("en-IN")}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>

          {/* By Type */}
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<SendOutlined />, "By Type")}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "0 0 4px" } }}
            >
              <Table
                dataSource={data.byType}
                rowKey="type"
                pagination={false}
                size="small"
                locale={{ emptyText: "No data for this period" }}
                columns={[
                  {
                    title: "Type",
                    dataIndex: "type",
                    render: (type: string) => {
                      const cfg = NOTIFICATION_TYPE_CONFIG[type];
                      return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? type}</Tag>;
                    },
                  },
                  {
                    title: "Campaigns",
                    dataIndex: "count",
                    width: 100,
                    align: "right" as const,
                    render: (v: number) => (
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{v}</span>
                    ),
                  },
                  {
                    title: "Notifications",
                    dataIndex: "notifications",
                    width: 120,
                    align: "right" as const,
                    render: (v: number) => (
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: BRAND.primary }}>
                        {v.toLocaleString("en-IN")}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>

        {/* ── Bottom: Top Campaigns + Recent Campaigns ──── */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<EyeOutlined />, "Top Campaigns by Read Rate")}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "0 0 4px" } }}
            >
              <Table
                dataSource={data.topCampaigns}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: "No campaigns yet" }}
                columns={[
                  {
                    title: "Title",
                    dataIndex: "title",
                    ellipsis: true,
                    render: (title: string) => (
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{title}</span>
                    ),
                  },
                  {
                    title: "Type",
                    dataIndex: "type",
                    width: 130,
                    render: (type: string) => {
                      const cfg = NOTIFICATION_TYPE_CONFIG[type];
                      return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? type}</Tag>;
                    },
                  },
                  {
                    title: "Recipients",
                    dataIndex: "recipientCount",
                    width: 90,
                    align: "right" as const,
                    render: (v: number) => (
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("en-IN")}</span>
                    ),
                  },
                  {
                    title: "Read Rate",
                    dataIndex: "readRate",
                    width: 90,
                    align: "right" as const,
                    sorter: (a: TopCampaign, b: TopCampaign) => a.readRate - b.readRate,
                    defaultSortOrder: "descend" as const,
                    render: (rate: number) => (
                      <span
                        style={{
                          fontWeight: 600,
                          fontVariantNumeric: "tabular-nums",
                          color: rate >= 50 ? BRAND.success : rate >= 25 ? BRAND.warning : BRAND.error,
                        }}
                      >
                        {rate}%
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<SendOutlined />, "Recent Campaigns")}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "0 0 4px" } }}
            >
              <Table
                dataSource={data.recentCampaigns}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: "No campaigns yet" }}
                columns={[
                  {
                    title: "Title",
                    dataIndex: "title",
                    ellipsis: true,
                    render: (title: string) => (
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{title}</span>
                    ),
                  },
                  {
                    title: "Type",
                    dataIndex: "type",
                    width: 130,
                    render: (type: string) => {
                      const cfg = NOTIFICATION_TYPE_CONFIG[type];
                      return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? type}</Tag>;
                    },
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    width: 100,
                    render: (status: string) => {
                      const cfg = CAMPAIGN_STATUS_CONFIG[status];
                      return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? status}</Tag>;
                    },
                  },
                  {
                    title: "Recipients",
                    dataIndex: "recipientCount",
                    width: 90,
                    align: "right" as const,
                    render: (v: number) => (
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("en-IN")}</span>
                    ),
                  },
                  {
                    title: "Sent",
                    dataIndex: "sentAt",
                    width: 100,
                    render: (d: string) =>
                      d ? (
                        <span style={{ fontSize: 12, color: token.colorTextSecondary }}>
                          {dayjs(d).format("DD MMM, HH:mm")}
                        </span>
                      ) : (
                        <span style={{ fontSize: 12, color: token.colorTextQuaternary }}>--</span>
                      ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
};
