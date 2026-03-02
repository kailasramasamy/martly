import { useState, useEffect, useCallback } from "react";
import { App, Card, Table, Tag, Space, Input, Spin, Typography } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import { axiosInstance } from "../../providers/data-provider";
import { MEMBERSHIP_STATUS_CONFIG, MEMBERSHIP_DURATION_CONFIG } from "../../constants/tag-colors";
import dayjs from "dayjs";

const { Text } = Typography;
const { Search } = Input;

interface Subscriber {
  id: string;
  status: string;
  startDate: string;
  endDate: string;
  pricePaid: number;
  user: { id: string; name: string; email: string; phone: string | null };
  plan: { name: string; duration: string };
}

export const MembershipSubscribers = () => {
  const { notification } = App.useApp();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const fetchSubscribers = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ page: String(page), pageSize: "20" });
      if (search) params.set("search", search);
      const res = await axiosInstance.get(`/memberships/subscribers?${params}`);
      setSubscribers(res?.data?.data ?? []);
      setTotal(res?.data?.meta?.total ?? 0);
    } catch {
      notification.error({ message: "Failed to load subscribers" });
    } finally {
      setLoading(false);
    }
  }, [notification, page, search]);

  useEffect(() => { fetchSubscribers(); }, [fetchSubscribers]);

  return (
    <Card title={<Space><TeamOutlined style={{ color: "#7c3aed" }} /><Text strong>Membership Subscribers</Text></Space>}>
      <Space direction="vertical" style={{ width: "100%", marginBottom: 16 }}>
        <Search
          placeholder="Search by name or email"
          allowClear
          onSearch={(v) => { setSearch(v); setPage(1); }}
          style={{ maxWidth: 360 }}
        />
      </Space>
      <Table
        dataSource={subscribers}
        rowKey="id"
        size="small"
        loading={loading}
        pagination={{ current: page, total, pageSize: 20, onChange: setPage, showTotal: (t) => `${t} subscribers` }}
      >
        <Table.Column title="Customer" render={(_, rec: Subscriber) => (
          <div>
            <Text strong>{rec.user.name}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{rec.user.email}</Text>
          </div>
        )} />
        <Table.Column title="Plan" render={(_, rec: Subscriber) => (
          <Space>
            <Text>{rec.plan.name}</Text>
            {(() => {
              const cfg = MEMBERSHIP_DURATION_CONFIG[rec.plan.duration];
              return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : null;
            })()}
          </Space>
        )} />
        <Table.Column dataIndex="pricePaid" title="Paid" render={(v: number) => `\u20B9${v}`} />
        <Table.Column dataIndex="startDate" title="Start" render={(v: string) => dayjs(v).format("DD MMM YYYY")} />
        <Table.Column dataIndex="endDate" title="Expires" render={(v: string) => dayjs(v).format("DD MMM YYYY")} />
        <Table.Column dataIndex="status" title="Status" render={(v: string) => {
          const cfg = MEMBERSHIP_STATUS_CONFIG[v];
          return cfg ? <Tag color={cfg.color}>{cfg.label}</Tag> : v;
        }} />
      </Table>
    </Card>
  );
};
