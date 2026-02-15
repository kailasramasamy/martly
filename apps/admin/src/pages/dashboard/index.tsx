import { useEffect, useState } from "react";
import { Row, Col, Card, Statistic, Spin, Typography } from "antd";
import {
  ShoppingCartOutlined,
  DollarOutlined,
  ShopOutlined,
  AppstoreOutlined,
  BarChartOutlined,
  LineChartOutlined,
} from "@ant-design/icons";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import axios from "axios";

import { BRAND, CHART_COLORS, sectionTitle } from "../../theme";

const { Title } = Typography;

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

interface DayData {
  date: string;
  count: number;
  revenue: number;
}

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  activeStores: number;
  totalProducts: number;
  ordersOverTime: DayData[];
  revenueOverTime: DayData[];
}

export const DashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    axios
      .get(`${API_URL}/api/v1/dashboard/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!stats) {
    return <div style={{ padding: 24 }}>Failed to load dashboard data.</div>;
  }

  const chartData = stats.ordersOverTime.map((d) => ({
    date: d.date.slice(5), // "MM-DD"
    orders: d.count,
    revenue: d.revenue,
  }));

  return (
    <div style={{ padding: 24 }}>
      <Title level={3}>Dashboard</Title>

      <Row gutter={[16, 16]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderLeft: `4px solid ${BRAND.primary}` }}>
            <Statistic
              title="Total Orders"
              value={stats.totalOrders}
              prefix={<ShoppingCartOutlined style={{ color: BRAND.primary }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderLeft: `4px solid ${BRAND.success}` }}>
            <Statistic
              title="Total Revenue"
              value={stats.totalRevenue}
              precision={2}
              prefix={<DollarOutlined style={{ color: BRAND.success }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderLeft: `4px solid ${BRAND.info}` }}>
            <Statistic
              title="Active Stores"
              value={stats.activeStores}
              prefix={<ShopOutlined style={{ color: BRAND.info }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ borderLeft: `4px solid ${BRAND.warning}` }}>
            <Statistic
              title="Total Products"
              value={stats.totalProducts}
              prefix={<AppstoreOutlined style={{ color: BRAND.warning }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<BarChartOutlined />, "Orders (Last 7 Days)")}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="orders" fill={CHART_COLORS.bar} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title={sectionTitle(<LineChartOutlined />, "Revenue (Last 7 Days)")}>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="revenue" stroke={CHART_COLORS.line} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>
    </div>
  );
};
