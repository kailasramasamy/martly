import { useState, useEffect } from "react";
import { Card, Row, Col, Spin, Table, Select, Space, Image, Rate, Statistic, Typography } from "antd";
import {
  StarOutlined,
  CommentOutlined,
  ClockCircleOutlined,
  MessageOutlined,
  ShopOutlined,
  CarOutlined,
  InboxOutlined,
} from "@ant-design/icons";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { axiosInstance } from "../../providers/data-provider";

const { Text } = Typography;

interface AnalyticsData {
  kpis: {
    totalReviews: number;
    avgRating: number;
    pendingModeration: number;
    responseRate: number;
  };
  distribution: Record<number, number>;
  volume: { date: string; count: number }[];
  topRated: { productId: string; name: string; imageUrl: string | null; avgRating: number; reviewCount: number }[];
  worstRated: { productId: string; name: string; imageUrl: string | null; avgRating: number; reviewCount: number }[];
  storeRatingSummary: { count: number; overall: number; delivery: number; packaging: number };
}

export const ReviewAnalytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    axiosInstance.get(`/review-analytics?days=${days}`)
      .then((res) => setData(res?.data?.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days]);

  if (loading || !data) {
    return <div style={{ display: "flex", justifyContent: "center", padding: 80 }}><Spin size="large" /></div>;
  }

  const distData = [5, 4, 3, 2, 1].map((star) => ({ star: `${star}\u2605`, count: data.distribution[star] ?? 0 }));

  const productColumns = [
    {
      title: "Product",
      dataIndex: "name",
      render: (name: string, r: any) => (
        <Space>
          {r.imageUrl && <Image src={r.imageUrl} width={28} height={28} style={{ borderRadius: 4, objectFit: "cover" }} preview={false} />}
          <span>{name}</span>
        </Space>
      ),
    },
    { title: "Avg Rating", dataIndex: "avgRating", render: (v: number) => <Rate disabled value={v} allowHalf style={{ fontSize: 13 }} /> },
    { title: "Reviews", dataIndex: "reviewCount" },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>
          <Space><CommentOutlined /> Review Analytics</Space>
        </h2>
        <Select value={days} onChange={setDays} style={{ width: 140 }}>
          <Select.Option value={7}>Last 7 days</Select.Option>
          <Select.Option value={30}>Last 30 days</Select.Option>
          <Select.Option value={90}>Last 90 days</Select.Option>
        </Select>
      </div>

      {/* KPI Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Reviews" value={data.kpis.totalReviews} prefix={<CommentOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Avg Rating" value={data.kpis.avgRating} prefix={<StarOutlined />} suffix="/ 5" precision={1} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Pending" value={data.kpis.pendingModeration} prefix={<ClockCircleOutlined />} valueStyle={data.kpis.pendingModeration > 0 ? { color: "#f59e0b" } : {}} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Response Rate" value={data.kpis.responseRate} prefix={<MessageOutlined />} suffix="%" /></Card>
        </Col>
      </Row>

      {/* Charts */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col xs={24} md={14}>
          <Card title="Review Volume" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={data.volume} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reviewGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0d9488" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0d9488" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#0d9488" fill="url(#reviewGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} md={10}>
          <Card title="Rating Distribution" size="small">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={distData} layout="vertical" margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="star" tick={{ fontSize: 12 }} width={40} />
                <Tooltip />
                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      {/* Store Rating Summary */}
      {data.storeRatingSummary.count > 0 && (
        <Card title="Store Ratings Summary" size="small" style={{ marginBottom: 20 }}>
          <Row gutter={16}>
            <Col xs={12} sm={6}>
              <Statistic title="Total Ratings" value={data.storeRatingSummary.count} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Overall" value={data.storeRatingSummary.overall} suffix="/ 5" precision={1} prefix={<ShopOutlined />} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Delivery" value={data.storeRatingSummary.delivery} suffix="/ 5" precision={1} prefix={<CarOutlined />} />
            </Col>
            <Col xs={12} sm={6}>
              <Statistic title="Packaging" value={data.storeRatingSummary.packaging} suffix="/ 5" precision={1} prefix={<InboxOutlined />} />
            </Col>
          </Row>
        </Card>
      )}

      {/* Top / Worst Products */}
      <Row gutter={[16, 16]}>
        <Col xs={24} md={12}>
          <Card title="Top Rated Products" size="small">
            <Table dataSource={data.topRated} columns={productColumns} rowKey="productId" pagination={false} size="small" />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card title="Lowest Rated Products" size="small">
            <Table dataSource={data.worstRated} columns={productColumns} rowKey="productId" pagination={false} size="small" />
          </Card>
        </Col>
      </Row>
    </div>
  );
};
