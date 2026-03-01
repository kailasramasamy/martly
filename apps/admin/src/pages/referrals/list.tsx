import { useState, useEffect, useCallback } from "react";
import { Table, Tag, Input, Select, Space, Card, Statistic, Row, Col, Typography } from "antd";
import { UsergroupAddOutlined, CheckCircleOutlined, ClockCircleOutlined, DollarOutlined, PercentageOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { REFERRAL_STATUS_CONFIG } from "../../constants/tag-colors";
import dayjs from "dayjs";

const { Search } = Input;
const { Text } = Typography;

interface ReferralItem {
  id: string;
  referrer: { id: string; name: string; email: string; referralCode: string | null };
  referee: { id: string; name: string; email: string };
  status: string;
  referrerReward: number;
  refereeReward: number;
  orderId: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface Stats {
  totalReferrals: number;
  pendingReferrals: number;
  completedReferrals: number;
  totalRewardsGiven: number;
  conversionRate: number;
}

export const ReferralList = () => {
  const [data, setData] = useState<ReferralItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (statusFilter) params.set("status", statusFilter);

      const [listRes, statsRes] = await Promise.all([
        axiosInstance.get(`/referrals/list?${params}`),
        axiosInstance.get("/referrals/stats"),
      ]);
      setData(listRes?.data?.data ?? []);
      setTotal(listRes?.data?.meta?.total ?? 0);
      setStats(statsRes?.data?.data ?? null);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const columns = [
    {
      title: "Referrer",
      key: "referrer",
      render: (_: any, rec: ReferralItem) => (
        <div>
          <Text strong>{rec.referrer.name || "—"}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{rec.referrer.email}</Text>
          {rec.referrer.referralCode && (
            <>
              <br />
              <Text code style={{ fontSize: 11 }}>{rec.referrer.referralCode}</Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: "Referee",
      key: "referee",
      render: (_: any, rec: ReferralItem) => (
        <div>
          <Text strong>{rec.referee.name || "—"}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{rec.referee.email}</Text>
        </div>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (status: string) => {
        const cfg = REFERRAL_STATUS_CONFIG[status] ?? { color: "default", label: status };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Referrer Reward",
      dataIndex: "referrerReward",
      key: "referrerReward",
      width: 130,
      render: (v: number) => `\u20B9${v}`,
    },
    {
      title: "Referee Reward",
      dataIndex: "refereeReward",
      key: "refereeReward",
      width: 130,
      render: (v: number) => `\u20B9${v}`,
    },
    {
      title: "Completed",
      dataIndex: "completedAt",
      key: "completedAt",
      width: 150,
      render: (v: string | null) => v ? dayjs(v).format("DD MMM YYYY") : "—",
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 150,
      render: (v: string) => dayjs(v).format("DD MMM YYYY"),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>
          <Space>
            <UsergroupAddOutlined style={{ color: "#0d9488" }} />
            Referrals
          </Space>
        </h2>
        <Text type="secondary">View and manage referral activity</Text>
      </div>

      {stats && (
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="Total" value={stats.totalReferrals} prefix={<UsergroupAddOutlined />} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="Pending" value={stats.pendingReferrals} prefix={<ClockCircleOutlined />} valueStyle={{ color: "#f59e0b" }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="Completed" value={stats.completedReferrals} prefix={<CheckCircleOutlined />} valueStyle={{ color: "#16a34a" }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card size="small">
              <Statistic title="Rewards Given" value={stats.totalRewardsGiven} prefix={"\u20B9"} valueStyle={{ color: "#0d9488" }} />
            </Card>
          </Col>
        </Row>
      )}

      <Space style={{ marginBottom: 16 }} wrap>
        <Search
          placeholder="Search by name or email..."
          allowClear
          onSearch={(v) => { setSearch(v); setPage(1); }}
          style={{ width: 280 }}
        />
        <Select
          placeholder="Filter by status"
          allowClear
          style={{ width: 160 }}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={[
            { label: "Pending", value: "PENDING" },
            { label: "Completed", value: "COMPLETED" },
            { label: "Expired", value: "EXPIRED" },
          ]}
        />
      </Space>

      <Table
        dataSource={data}
        columns={columns}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
      />
    </div>
  );
};
