import { useCallback, useEffect, useState } from "react";
import { Card, Table, Tag, Space, Input, Select, DatePicker, Button, Typography, Spin } from "antd";
import { EyeOutlined, SearchOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";
import dayjs from "dayjs";

import { axiosInstance } from "../../../providers/data-provider";
import { BRAND } from "../../../theme";
import {
  NOTIFICATION_TYPE_CONFIG,
  CAMPAIGN_STATUS_CONFIG,
  AUDIENCE_TYPE_CONFIG,
} from "../../../constants/tag-colors";

const { Title } = Typography;
const { RangePicker } = DatePicker;

interface Campaign {
  id: string;
  title: string;
  body: string;
  type: string;
  audienceType: string;
  recipientCount: number;
  status: string;
  sentAt: string | null;
  readCount: number;
  readRate: number;
  sentByUser: { name: string } | null;
}

export const CampaignList = () => {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page, pageSize };
      if (search) params.q = search;
      if (type) params.type = type;
      if (dateRange) {
        params.from = dateRange[0].startOf("day").toISOString();
        params.to = dateRange[1].endOf("day").toISOString();
      }
      const res = await axiosInstance.get("/notifications/admin/campaigns", { params });
      setCampaigns(res.data?.data ?? []);
      setTotal(res.data?.meta?.total ?? 0);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, type, dateRange]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [search, type, dateRange]);

  return (
    <div style={{ padding: "16px 24px 32px" }}>
      <Title level={4} style={{ marginBottom: 20 }}>Campaign History</Title>

      <Card style={{ marginBottom: 16 }} styles={{ body: { padding: "12px 16px" } }}>
        <Space wrap>
          <Input
            placeholder="Search campaigns..."
            prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 260 }}
          />
          <Select
            placeholder="Type"
            allowClear
            value={type}
            onChange={setType}
            style={{ width: 180 }}
            options={[
              { label: "Promotional", value: "PROMOTIONAL" },
              { label: "General", value: "GENERAL" },
            ]}
          />
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            format="DD MMM YYYY"
          />
        </Space>
      </Card>

      <Card styles={{ body: { padding: 0 } }}>
        <Table
          dataSource={campaigns}
          rowKey="id"
          size="small"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `${t} campaigns`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          columns={[
            {
              title: "Title",
              dataIndex: "title",
              ellipsis: true,
              render: (title: string) => (
                <span style={{ fontWeight: 500 }}>{title}</span>
              ),
            },
            {
              title: "Type",
              dataIndex: "type",
              width: 140,
              render: (v: string) => {
                const cfg = NOTIFICATION_TYPE_CONFIG[v];
                return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? v}</Tag>;
              },
            },
            {
              title: "Audience",
              dataIndex: "audienceType",
              width: 140,
              render: (v: string) => {
                const cfg = AUDIENCE_TYPE_CONFIG[v];
                return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? v}</Tag>;
              },
            },
            {
              title: "Recipients",
              dataIndex: "recipientCount",
              width: 100,
              align: "right" as const,
              render: (v: number) => (
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{v.toLocaleString("en-IN")}</span>
              ),
            },
            {
              title: "Read Rate",
              dataIndex: "readRate",
              width: 100,
              align: "right" as const,
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
            {
              title: "Status",
              dataIndex: "status",
              width: 110,
              render: (v: string) => {
                const cfg = CAMPAIGN_STATUS_CONFIG[v];
                return <Tag color={cfg?.color ?? "default"}>{cfg?.label ?? v}</Tag>;
              },
            },
            {
              title: "Sent At",
              dataIndex: "sentAt",
              width: 150,
              render: (d: string | null) =>
                d ? (
                  <span style={{ fontSize: 13 }}>{dayjs(d).format("DD MMM YYYY, HH:mm")}</span>
                ) : (
                  <span style={{ color: "#94a3b8" }}>--</span>
                ),
            },
            {
              title: "Actions",
              width: 70,
              align: "center" as const,
              render: (_: unknown, rec: Campaign) => (
                <Button
                  type="text"
                  size="small"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(`/notifications/campaigns/show/${rec.id}`)}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};
