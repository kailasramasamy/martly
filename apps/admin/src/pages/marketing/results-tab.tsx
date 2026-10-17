import { useEffect, useState } from "react";
import { App, Card, Image, Segmented, Table, Tag } from "antd";
import dayjs from "dayjs";
import { SponsorTypeLabels, type SponsorType } from "@martly/shared/constants";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees } from "../promos/promo-utils";
import { errorMessage } from "./utils";

const DAY_OPTIONS = [7, 30, 90].map((d) => ({ value: d, label: `${d} days` }));

interface BannerResult {
  id: string;
  title: string;
  imageUrl: string;
  sponsorType: SponsorType;
  views: number;
  taps: number;
  ctr: number;
}

interface PromotionResult {
  id: string;
  brief: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  copy: { en?: { title?: string } } | null;
  orders: number;
  units: number;
  revenue: number;
}

const range = (a: string | null, b: string | null) => (a ? `${dayjs(a).format("D MMM")} – ${b ? dayjs(b).format("D MMM") : "open"}` : "—");

const bannerColumns = [
  { title: "", dataIndex: "imageUrl", width: 80, render: (url: string) => <Image src={url} width={60} height={40} style={{ objectFit: "cover", borderRadius: 4 }} /> },
  { title: "Banner", dataIndex: "title" },
  { title: "Sponsor", dataIndex: "sponsorType", render: (v: SponsorType) => <Tag>{SponsorTypeLabels[v]}</Tag> },
  { title: "Views", dataIndex: "views", align: "right" as const, render: (v: number) => v.toLocaleString("en-IN") },
  { title: "Taps", dataIndex: "taps", align: "right" as const, render: (v: number) => v.toLocaleString("en-IN") },
  { title: "CTR", dataIndex: "ctr", align: "right" as const, render: (v: number) => `${v}%` },
];

const promotionColumns = [
  { title: "Promotion", render: (_: unknown, r: PromotionResult) => r.copy?.en?.title ?? r.brief },
  { title: "Status", dataIndex: "status", render: (v: string) => <Tag>{v}</Tag> },
  { title: "Ran", render: (_: unknown, r: PromotionResult) => range(r.startsAt, r.endsAt) },
  { title: "Orders", dataIndex: "orders", align: "right" as const },
  { title: "Units", dataIndex: "units", align: "right" as const },
  { title: "Revenue", dataIndex: "revenue", align: "right" as const, render: formatRupees },
];

export function ResultsTab() {
  const { notification } = App.useApp();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ banners: BannerResult[]; promotions: PromotionResult[] } | null>(null);

  useEffect(() => {
    setData(null);
    axiosInstance.get("/marketing/results", { params: { days } })
      .then((res) => setData(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load results") }));
  }, [days, notification]);

  return (
    <>
      <Segmented options={DAY_OPTIONS} value={days} onChange={(v) => setDays(Number(v))} style={{ marginBottom: 16 }} />
      <Card title="Banners" size="small" style={{ marginBottom: 16 }}>
        <Table size="small" rowKey="id" loading={!data} dataSource={data?.banners} columns={bannerColumns} pagination={false} />
      </Card>
      <Card title="Promotions" size="small">
        <Table size="small" rowKey="id" loading={!data} dataSource={data?.promotions} columns={promotionColumns} pagination={false} />
      </Card>
    </>
  );
}
