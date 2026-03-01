import { useState, useEffect } from "react";
import { Card, Table, Rate, Space, Statistic, Row, Col, Spin, Select, Typography } from "antd";
import { ShopOutlined, CarOutlined, InboxOutlined, StarOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";

const { Text } = Typography;

interface StoreOption {
  id: string;
  name: string;
}

export const StoreRatingList = () => {
  const [ratings, setRatings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState<string | undefined>();
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [summary, setSummary] = useState<{ count: number; overall: number; delivery: number; packaging: number } | null>(null);

  useEffect(() => {
    axiosInstance.get("/stores?pageSize=100").then((res) => {
      setStores((res?.data?.data ?? []).map((s: any) => ({ id: s.id, name: s.name })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), pageSize: "20" });
    if (storeId) params.set("storeId", storeId);

    axiosInstance.get(`/store-ratings/admin?${params}`)
      .then((res) => {
        setRatings(res?.data?.data ?? []);
        setTotal(res?.data?.meta?.total ?? 0);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [page, storeId]);

  // Fetch summary for selected store (or all)
  useEffect(() => {
    if (storeId) {
      axiosInstance.get(`/store-ratings/store/${storeId}/summary`)
        .then((res) => setSummary(res?.data?.data))
        .catch(() => setSummary(null));
    } else {
      setSummary(null);
    }
  }, [storeId]);

  const columns = [
    { title: "Store", dataIndex: ["store", "name"] },
    { title: "Customer", dataIndex: ["user", "name"] },
    {
      title: "Overall",
      dataIndex: "overallRating",
      render: (v: number) => <Rate disabled value={v} style={{ fontSize: 13 }} />,
    },
    {
      title: "Delivery",
      dataIndex: "deliveryRating",
      render: (v: number | null) => v ? <Rate disabled value={v} style={{ fontSize: 13 }} /> : "—",
    },
    {
      title: "Packaging",
      dataIndex: "packagingRating",
      render: (v: number | null) => v ? <Rate disabled value={v} style={{ fontSize: 13 }} /> : "—",
    },
    {
      title: "Comment",
      dataIndex: "comment",
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "Date",
      dataIndex: "createdAt",
      render: (v: string) => new Date(v).toLocaleDateString(),
    },
  ];

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>
          <Space><StarOutlined /> Store Ratings</Space>
        </h2>
        <Select
          placeholder="Filter by store"
          allowClear
          style={{ width: 200 }}
          value={storeId}
          onChange={(v) => { setStoreId(v); setPage(1); }}
        >
          {stores.map((s) => <Select.Option key={s.id} value={s.id}>{s.name}</Select.Option>)}
        </Select>
      </div>

      {summary && (
        <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <Card size="small"><Statistic title="Total Ratings" value={summary.count} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small"><Statistic title="Overall" value={summary.overall} suffix="/ 5" precision={1} prefix={<ShopOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small"><Statistic title="Delivery" value={summary.delivery} suffix="/ 5" precision={1} prefix={<CarOutlined />} /></Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small"><Statistic title="Packaging" value={summary.packaging} suffix="/ 5" precision={1} prefix={<InboxOutlined />} /></Card>
          </Col>
        </Row>
      )}

      <Card>
        <Table
          dataSource={ratings}
          columns={columns}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={{
            total,
            current: page,
            pageSize: 20,
            onChange: setPage,
            showTotal: (t) => `${t} ratings`,
          }}
        />
      </Card>
    </div>
  );
};
