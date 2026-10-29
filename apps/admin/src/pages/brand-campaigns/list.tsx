import { useEffect, useState } from "react";
import { List } from "@refinedev/antd";
import { App, Button, Select, Space, Table, Tag } from "antd";
import { CalendarOutlined, PlusOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router";
import dayjs from "dayjs";
import { BrandCampaignStatusLabels, type BrandCampaignStatus } from "@martly/shared/constants";
import { BRAND_CAMPAIGN_STATUS_COLORS } from "../../constants/tag-colors";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import { errorMessage } from "../marketing/utils";
import { BrandSelect } from "./brand-select";
import { BrandLogo } from "../brands/brand-parts";
import type { Campaign, CampaignScope } from "./types";

const statusOptions = Object.entries(BrandCampaignStatusLabels).map(([value, label]) => ({ value, label }));

export const CampaignStatusTag = ({ status }: { status: BrandCampaignStatus }) => (
  <Tag color={BRAND_CAMPAIGN_STATUS_COLORS[status]}>{BrandCampaignStatusLabels[status]}</Tag>
);

export function CampaignList({ scope }: { scope: CampaignScope }) {
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>();
  const [brandId, setBrandId] = useState<string>();

  useEffect(() => {
    setLoading(true);
    axiosInstance.get(scope.apiBase, { params: { status, brandId } })
      .then((res) => setRows(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load campaigns") }))
      .finally(() => setLoading(false));
  }, [scope.apiBase, status, brandId, notification]);

  const columns = [
    ...(scope.mode === "platform"
      ? [{ title: "Brand", render: (_: unknown, c: Campaign) => <Space><BrandLogo brand={c.brand} height={24} />{c.brand.name}</Space> }]
      : []),
    { title: "Campaign", dataIndex: "title" },
    { title: "Package", render: (_: unknown, c: Campaign) => `${c.product.name} × ${c.quantity}` },
    { title: "Status", dataIndex: "status", render: (s: BrandCampaignStatus) => <CampaignStatusTag status={s} /> },
    { title: "Runs", render: (_: unknown, c: Campaign) => `${dayjs(c.startsAt).format("D MMM")} – ${dayjs(c.endsAt).format("D MMM YYYY")}` },
    { title: "Price", align: "right" as const, render: (_: unknown, c: Campaign) => formatRupees(c.product.price * c.quantity) },
    { title: "", render: (_: unknown, c: Campaign) => <Button size="small" onClick={() => navigate(`${scope.path}/show/${c.id}`)}>Open</Button> },
  ];

  return (
    <List
      title={scope.mode === "platform" ? "Brand campaigns" : "Campaigns"}
      headerButtons={scope.mode === "platform" ? (
        <Space>
          <Button icon={<CalendarOutlined />} onClick={() => navigate(`${scope.path}/calendar`)}>Calendar</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate(`${scope.path}/create`)}>New campaign</Button>
        </Space>
      ) : undefined}
    >
      <Space wrap style={{ marginBottom: 16 }}>
        <Select allowClear placeholder="Status" options={statusOptions} value={status} onChange={setStatus} style={{ width: 180 }} />
        {scope.mode === "platform" && <BrandSelect allowClear value={brandId} onChange={setBrandId} placeholder="Brand" />}
      </Space>
      <Table size="small" rowKey="id" loading={loading} dataSource={rows} columns={columns} pagination={{ pageSize: 25 }} />
    </List>
  );
}
