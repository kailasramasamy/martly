import { useCallback, useEffect, useState } from "react";
import { Row, Col, Card, Spin, Tag, Segmented, Table, theme as antTheme } from "antd";
import {
  ArrowUpOutlined,
  ArrowDownOutlined,
  ShoppingCartOutlined,
  DollarOutlined,
  TeamOutlined,
  WalletOutlined,
  TrophyOutlined,
  ClockCircleOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import axios from "axios";

import { BRAND, CHART_COLORS, sectionTitle } from "../../theme";
import { ORDER_STATUS_CONFIG, FULFILLMENT_TYPE_CONFIG } from "../../constants/tag-colors";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

/* ── Hex colors for donut slices (mapped from Ant tag color names) ── */
const ANT_TAG_HEX: Record<string, string> = {
  orange: "#fa8c16",
  blue: "#1677ff",
  cyan: "#13c2c2",
  geekblue: "#2f54eb",
  purple: "#722ed1",
  green: "#52c41a",
  red: "#f5222d",
  gold: "#faad14",
};

const PAYMENT_COLORS: Record<string, string> = {
  COD: "#fa8c16",
  ONLINE: BRAND.primary,
};

const PAYMENT_LABELS: Record<string, string> = {
  COD: "Cash on Delivery",
  ONLINE: "Online Payment",
};

/* ── Types ─────────────────────────────────────────────── */
interface KPIs {
  totalRevenue: number;
  previousRevenue: number;
  totalOrders: number;
  previousOrders: number;
  averageOrderValue: number;
  previousAOV: number;
  totalCustomers: number;
  previousCustomers: number;
}

interface DashboardData {
  kpis: KPIs;
  revenueOverTime: { date: string; revenue: number }[];
  ordersOverTime: { date: string; count: number }[];
  ordersByStatus: { status: string; count: number }[];
  revenueByPaymentMethod: { method: string; revenue: number; count: number }[];
  ordersByFulfillment: { type: string; count: number }[];
  topProducts: { name: string; quantity: number; revenue: number }[];
  recentOrders: {
    id: string;
    status: string;
    totalAmount: number;
    paymentMethod: string;
    createdAt: string;
    customerName: string;
  }[];
}

/* ── Helpers ───────────────────────────────────────────── */
function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function formatCurrency(n: number): string {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toFixed(0)}`;
}

function formatDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  if (days <= 7) return d.toLocaleDateString("en-IN", { weekday: "short" });
  if (days <= 30) return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/* ── KPI Card ──────────────────────────────────────────── */
function KpiCard({
  title,
  value,
  prefix,
  change,
  icon,
  accent,
}: {
  title: string;
  value: string;
  prefix?: string;
  change: number | null;
  icon: React.ReactNode;
  accent: string;
}) {
  const { token } = antTheme.useToken();
  const isUp = change !== null && change >= 0;
  const changeColor = change === null ? token.colorTextQuaternary : isUp ? "#16a34a" : "#ef4444";

  return (
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
          background: `linear-gradient(90deg, ${accent}, ${accent}88)`,
        }}
      />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 500,
              color: token.colorTextSecondary,
              marginBottom: 8,
              letterSpacing: 0.3,
              textTransform: "uppercase",
            }}
          >
            {title}
          </div>
          <div
            style={{
              fontSize: 28,
              fontWeight: 700,
              color: token.colorText,
              lineHeight: 1.1,
              letterSpacing: -0.5,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {prefix}
            {value}
          </div>
          <div
            style={{
              marginTop: 10,
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 13,
              fontWeight: 600,
              color: changeColor,
            }}
          >
            {change !== null ? (
              <>
                {isUp ? <ArrowUpOutlined style={{ fontSize: 11 }} /> : <ArrowDownOutlined style={{ fontSize: 11 }} />}
                {Math.abs(change)}%
                <span style={{ color: token.colorTextQuaternary, fontWeight: 400, marginLeft: 2 }}>
                  vs prior period
                </span>
              </>
            ) : (
              <span style={{ fontWeight: 400 }}>No prior data</span>
            )}
          </div>
        </div>

        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${accent}14`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 20,
            color: accent,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}

/* ── Custom Tooltip ────────────────────────────────────── */
function ChartTooltip(props: { active?: boolean; payload?: any[]; label?: string; prefix?: string; suffix?: string }) {
  const { token } = antTheme.useToken();
  const { active, payload, label, prefix, suffix } = props;
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: token.colorBgElevated,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: 8,
        padding: "8px 12px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
      }}
    >
      <div style={{ fontSize: 11, color: token.colorTextSecondary, marginBottom: 4 }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ fontSize: 14, fontWeight: 600, color: p.color || token.colorText }}>
          {prefix}{typeof p.value === "number" ? p.value.toLocaleString("en-IN") : p.value}{suffix}
        </div>
      ))}
    </div>
  );
}

/* ── Donut Center Label ────────────────────────────────── */
function DonutCenter({ total, label }: { total: number; label: string }) {
  const { token } = antTheme.useToken();
  return (
    <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle">
      <tspan x="50%" dy="-8" fontSize="20" fontWeight="700" fill={token.colorText}>
        {total.toLocaleString("en-IN")}
      </tspan>
      <tspan x="50%" dy="22" fontSize="11" fill={token.colorTextSecondary}>
        {label}
      </tspan>
    </text>
  );
}

/* ── Donut Legend ───────────────────────────────────────── */
function DonutLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  const { token } = antTheme.useToken();
  if (!payload) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 14px", marginTop: 4 }}>
      {payload.map((entry, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: token.colorTextSecondary }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
          {entry.value}
        </div>
      ))}
    </div>
  );
}

/* ── Main Dashboard ────────────────────────────────────── */
export const DashboardPage = () => {
  const { token } = antTheme.useToken();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<number>(7);

  const fetchData = useCallback((period: number) => {
    setLoading(true);
    const tkn = localStorage.getItem(TOKEN_KEY);
    axios
      .get(`${API_URL}/api/v1/dashboard/stats?days=${period}`, {
        headers: { Authorization: `Bearer ${tkn}` },
      })
      .then((res) => setData(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
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
    return <div style={{ padding: 24, color: token.colorTextSecondary }}>Failed to load dashboard data.</div>;
  }

  const { kpis } = data;

  /* Chart data transforms */
  const revenueChartData = data.revenueOverTime.map((d) => ({
    date: formatDate(d.date, days),
    revenue: d.revenue,
  }));

  const ordersChartData = data.ordersOverTime.map((d) => ({
    date: formatDate(d.date, days),
    orders: d.count,
  }));

  const statusDonut = data.ordersByStatus.map((d) => ({
    name: ORDER_STATUS_CONFIG[d.status]?.label ?? d.status,
    value: d.count,
    color: ANT_TAG_HEX[ORDER_STATUS_CONFIG[d.status]?.color] ?? "#999",
  }));

  const paymentDonut = data.revenueByPaymentMethod.map((d) => ({
    name: PAYMENT_LABELS[d.method] ?? d.method,
    value: Math.round(d.revenue),
    color: PAYMENT_COLORS[d.method] ?? "#999",
  }));

  const fulfillmentDonut = data.ordersByFulfillment.map((d) => ({
    name: FULFILLMENT_TYPE_CONFIG[d.type]?.label ?? d.type,
    value: d.count,
    color: ANT_TAG_HEX[FULFILLMENT_TYPE_CONFIG[d.type]?.color] ?? "#999",
  }));

  const statusTotal = statusDonut.reduce((s, d) => s + d.value, 0);
  const paymentTotal = paymentDonut.reduce((s, d) => s + d.value, 0);
  const fulfillmentTotal = fulfillmentDonut.reduce((s, d) => s + d.value, 0);

  const periodLabel = days === 7 ? "7 days" : days === 30 ? "30 days" : "90 days";

  return (
    <div style={{ padding: "16px 24px 32px", maxWidth: 1400, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: token.colorText, letterSpacing: -0.3 }}>
            Analytics
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 13, color: token.colorTextTertiary }}>
            Business performance overview
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

      {/* Spinner overlay for period change */}
      <Spin spinning={loading}>
        {/* ── KPI Cards ─────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Revenue"
              value={formatCurrency(kpis.totalRevenue)}
              change={pctChange(kpis.totalRevenue, kpis.previousRevenue)}
              icon={<DollarOutlined />}
              accent={BRAND.primary}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Orders"
              value={kpis.totalOrders.toLocaleString("en-IN")}
              change={pctChange(kpis.totalOrders, kpis.previousOrders)}
              icon={<ShoppingCartOutlined />}
              accent={BRAND.info}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Avg Order Value"
              value={`₹${kpis.averageOrderValue.toFixed(0)}`}
              change={pctChange(kpis.averageOrderValue, kpis.previousAOV)}
              icon={<WalletOutlined />}
              accent={BRAND.warning}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Customers"
              value={kpis.totalCustomers.toLocaleString("en-IN")}
              change={pctChange(kpis.totalCustomers, kpis.previousCustomers)}
              icon={<TeamOutlined />}
              accent="#8b5cf6"
            />
          </Col>
        </Row>

        {/* ── Charts Row ────────────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<DollarOutlined />, `Revenue — ${periodLabel}`)}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "12px 8px 8px" } }}
            >
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={revenueChartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={BRAND.primary} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={BRAND.primary} stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: token.colorTextQuaternary }}
                    axisLine={{ stroke: token.colorBorderSecondary }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: token.colorTextQuaternary }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => (v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`)}
                  />
                  <RechartsTooltip content={<ChartTooltip prefix="₹" />} />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke={BRAND.primary}
                    strokeWidth={2.5}
                    fill="url(#revGradient)"
                    dot={false}
                    activeDot={{ r: 5, fill: BRAND.primary, strokeWidth: 2, stroke: "#fff" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<ShoppingCartOutlined />, `Orders — ${periodLabel}`)}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "12px 8px 8px" } }}
            >
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={ordersChartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={token.colorBorderSecondary} vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: token.colorTextQuaternary }}
                    axisLine={{ stroke: token.colorBorderSecondary }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: token.colorTextQuaternary }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip content={<ChartTooltip suffix=" orders" />} />
                  <Bar dataKey="orders" fill={CHART_COLORS.bar} radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        </Row>

        {/* ── Breakdown Donuts ──────────────────────────── */}
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          {[
            { title: "Orders by Status", data: statusDonut, total: statusTotal, label: "orders" },
            { title: "Revenue by Payment", data: paymentDonut, total: paymentTotal, label: "total", isCurrency: true },
            { title: "Fulfillment Split", data: fulfillmentDonut, total: fulfillmentTotal, label: "orders" },
          ].map((chart) => (
            <Col xs={24} md={8} key={chart.title}>
              <Card
                title={<span style={{ fontSize: 14, fontWeight: 600 }}>{chart.title}</span>}
                style={{ borderRadius: 10, textAlign: "center" }}
                styles={{ body: { padding: "8px 8px 12px" } }}
              >
                {chart.data.length === 0 ? (
                  <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", color: token.colorTextQuaternary }}>
                    No data
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie
                        data={chart.data}
                        cx="50%"
                        cy="45%"
                        innerRadius={55}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        strokeWidth={0}
                      >
                        {chart.data.map((d, i) => (
                          <Cell key={i} fill={d.color} />
                        ))}
                      </Pie>
                      <Legend
                        content={<DonutLegend />}
                        verticalAlign="bottom"
                      />
                      {/* Center label */}
                      <text x="50%" y="40%" textAnchor="middle" dominantBaseline="middle">
                        <tspan
                          x="50%"
                          dy="0"
                          fontSize="18"
                          fontWeight="700"
                          fill={token.colorText}
                        >
                          {chart.isCurrency ? `₹${(chart.total / 1000).toFixed(1)}K` : chart.total.toLocaleString("en-IN")}
                        </tspan>
                      </text>
                      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle">
                        <tspan fontSize="11" fill={token.colorTextSecondary}>
                          {chart.label}
                        </tspan>
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Bottom: Top Products + Recent Orders ──── */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<TrophyOutlined />, "Top Products")}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "0 0 4px" } }}
            >
              <Table
                dataSource={data.topProducts}
                rowKey="name"
                pagination={false}
                size="small"
                locale={{ emptyText: "No delivered orders yet" }}
                columns={[
                  {
                    title: "#",
                    key: "rank",
                    width: 40,
                    render: (_, __, i) => (
                      <span
                        style={{
                          fontWeight: 600,
                          color: i < 3 ? BRAND.primary : token.colorTextQuaternary,
                          fontSize: 12,
                        }}
                      >
                        {i + 1}
                      </span>
                    ),
                  },
                  {
                    title: "Product",
                    dataIndex: "name",
                    ellipsis: true,
                    render: (name: string) => (
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{name}</span>
                    ),
                  },
                  {
                    title: "Qty",
                    dataIndex: "quantity",
                    width: 60,
                    align: "right" as const,
                    render: (q: number) => (
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>{q}</span>
                    ),
                  },
                  {
                    title: "Revenue",
                    dataIndex: "revenue",
                    width: 100,
                    align: "right" as const,
                    render: (r: number) => (
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", color: BRAND.primary }}>
                        ₹{r.toLocaleString("en-IN")}
                      </span>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={sectionTitle(<ClockCircleOutlined />, "Recent Orders")}
              style={{ borderRadius: 10 }}
              styles={{ body: { padding: "0 0 4px" } }}
            >
              <Table
                dataSource={data.recentOrders}
                rowKey="id"
                pagination={false}
                size="small"
                locale={{ emptyText: "No orders yet" }}
                columns={[
                  {
                    title: "Order",
                    dataIndex: "id",
                    width: 90,
                    render: (id: string) => (
                      <span
                        style={{
                          fontFamily: "monospace",
                          fontSize: 12,
                          color: token.colorTextSecondary,
                        }}
                      >
                        #{id.slice(-6).toUpperCase()}
                      </span>
                    ),
                  },
                  {
                    title: "Customer",
                    dataIndex: "customerName",
                    ellipsis: true,
                    render: (name: string) => (
                      <span style={{ fontWeight: 500, fontSize: 13 }}>{name}</span>
                    ),
                  },
                  {
                    title: "Amount",
                    dataIndex: "totalAmount",
                    width: 90,
                    align: "right" as const,
                    render: (amt: number) => (
                      <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                        ₹{amt.toLocaleString("en-IN")}
                      </span>
                    ),
                  },
                  {
                    title: "Status",
                    dataIndex: "status",
                    width: 120,
                    render: (status: string) => {
                      const cfg = ORDER_STATUS_CONFIG[status];
                      return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? status}</Tag>;
                    },
                  },
                  {
                    title: "Time",
                    dataIndex: "createdAt",
                    width: 80,
                    render: (t: string) => (
                      <span style={{ fontSize: 12, color: token.colorTextSecondary }}>{timeAgo(t)}</span>
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
