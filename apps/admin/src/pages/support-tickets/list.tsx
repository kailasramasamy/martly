import { useCallback, useEffect, useState } from "react";
import { Card, Table, Tag, Space, Input, Select, Typography, Spin, Row, Col, Statistic } from "antd";
import { EyeOutlined, MessageOutlined, ClockCircleOutlined, CheckCircleOutlined, InboxOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";
import { axiosInstance } from "../../providers/data-provider";
import { TICKET_STATUS_CONFIG, TICKET_PRIORITY_CONFIG } from "../../constants/tag-colors";

const { Title } = Typography;

interface TicketStats {
  total: number;
  open: number;
  resolved: number;
  closed: number;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  createdAt: string;
  user: { id: string; name: string; email: string; phone: string | null };
  store: { id: string; name: string } | null;
  order: { id: string; status: string; totalAmount: string } | null;
}

export const SupportTicketList = () => {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [status, setStatus] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState<TicketStats>({ total: 0, open: 0, resolved: 0, closed: 0 });

  const fetchStats = useCallback(async () => {
    try {
      const res = await axiosInstance.get("/support/tickets/stats");
      setStats(res.data?.data || { total: 0, open: 0, resolved: 0, closed: 0 });
    } catch {
      // silently fail
    }
  }, []);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (status) params.status = status;
      if (search) params.search = search;

      const res = await axiosInstance.get("/support/tickets", { params });
      setTickets(res.data?.data || []);
      setTotal(res.data?.meta?.total || 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, status, search]);

  useEffect(() => {
    fetchTickets();
    fetchStats();
  }, [fetchTickets, fetchStats]);

  const columns = [
    {
      title: "Subject",
      dataIndex: "subject",
      key: "subject",
      ellipsis: true,
      width: 280,
    },
    {
      title: "Customer",
      key: "customer",
      render: (_: unknown, rec: Ticket) => (
        <div>
          <div style={{ fontWeight: 500 }}>{rec.user?.name}</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>
            {rec.user?.email || rec.user?.phone}
          </div>
        </div>
      ),
    },
    {
      title: "Store",
      key: "store",
      render: (_: unknown, rec: Ticket) => rec.store?.name || "\u2014",
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (val: string) => {
        const cfg = TICKET_STATUS_CONFIG[val] || { color: "default", label: val };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Priority",
      dataIndex: "priority",
      key: "priority",
      width: 100,
      render: (val: string) => {
        const cfg = TICKET_PRIORITY_CONFIG[val] || { color: "default", label: val };
        return <Tag color={cfg.color}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Order",
      key: "order",
      width: 120,
      render: (_: unknown, rec: Ticket) =>
        rec.order ? <Tag>#{rec.order.id.slice(0, 8)}</Tag> : "\u2014",
    },
    {
      title: "Created",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 180,
      render: (val: string) =>
        new Date(val).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
    },
    {
      title: "",
      key: "actions",
      width: 60,
      render: (_: unknown, rec: Ticket) => (
        <EyeOutlined
          style={{ cursor: "pointer", color: "#0d9488" }}
          onClick={() => navigate(`/support-tickets/show/${rec.id}`)}
        />
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Support Tickets</Title>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total" value={stats.total} prefix={<MessageOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Open" value={stats.open} prefix={<ClockCircleOutlined />} valueStyle={{ color: "#f59e0b" }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Resolved" value={stats.resolved} prefix={<CheckCircleOutlined />} valueStyle={{ color: "#16a34a" }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Closed" value={stats.closed} prefix={<InboxOutlined />} valueStyle={{ color: "#64748b" }} />
          </Card>
        </Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input.Search
            placeholder="Search by subject, customer..."
            allowClear
            onSearch={(val) => { setSearch(val); setPage(1); }}
            style={{ width: 280 }}
          />
          <Select
            placeholder="Status"
            allowClear
            value={status}
            onChange={(val) => { setStatus(val); setPage(1); }}
            style={{ width: 140 }}
            options={[
              { label: "Open", value: "OPEN" },
              { label: "Resolved", value: "RESOLVED" },
              { label: "Closed", value: "CLOSED" },
            ]}
          />
        </Space>
      </Card>

      <Spin spinning={loading}>
        <Table
          dataSource={tickets}
          columns={columns}
          rowKey="id"
          size="small"
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `${t} tickets`,
          }}
        />
      </Spin>
    </div>
  );
};
