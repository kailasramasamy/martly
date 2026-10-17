import { useEffect, useState } from "react";
import { App, Card, Image, Segmented, Table, Tag } from "antd";
import dayjs from "dayjs";
import { axiosInstance } from "../../providers/data-provider";
import { formatRupees, PromoKindTag } from "../promos/promo-utils";
import { errorMessage } from "./utils";

const DAY_OPTIONS = [7, 30, 90].map((d) => ({ value: d, label: `${d} days` }));

interface PromotionResult {
  id: string;
  kind: "AI" | "MANUAL";
  title: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  imageUrl: string | null;
  views: number;
  taps: number;
  ctr: number;
  orders: number;
  units: number;
  revenue: number;
}

const range = (a: string | null, b: string | null) => (a ? `${dayjs(a).format("D MMM")} – ${b ? dayjs(b).format("D MMM") : "open"}` : "—");
const count = (v: number) => v.toLocaleString("en-IN");

const promotionColumns = [
  { title: "", dataIndex: "imageUrl", width: 80, render: (url: string | null) => url && <Image src={url} width={60} height={40} style={{ objectFit: "cover", borderRadius: 4 }} /> },
  { title: "Promotion", dataIndex: "title" },
  { title: "Kind", dataIndex: "kind", render: (v: PromotionResult["kind"]) => <PromoKindTag kind={v} /> },
  { title: "Status", dataIndex: "status", render: (v: string) => <Tag>{v}</Tag> },
  { title: "Ran", render: (_: unknown, r: PromotionResult) => range(r.startsAt, r.endsAt) },
  { title: "Views", dataIndex: "views", align: "right" as const, render: count },
  { title: "Taps", dataIndex: "taps", align: "right" as const, render: count },
  { title: "CTR", dataIndex: "ctr", align: "right" as const, render: (v: number) => `${v}%` },
  { title: "Orders", dataIndex: "orders", align: "right" as const },
  { title: "Units", dataIndex: "units", align: "right" as const },
  { title: "Revenue", dataIndex: "revenue", align: "right" as const, render: formatRupees },
];

export function ResultsTab() {
  const { notification } = App.useApp();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<{ promotions: PromotionResult[] } | null>(null);

  useEffect(() => {
    setData(null);
    axiosInstance.get("/marketing/results", { params: { days } })
      .then((res) => setData(res.data.data))
      .catch((err) => notification.error({ message: errorMessage(err, "Could not load results") }));
  }, [days, notification]);

  return (
    <>
      <Segmented options={DAY_OPTIONS} value={days} onChange={(v) => setDays(Number(v))} style={{ marginBottom: 16 }} />
      <Card title="Promotions" size="small">
        <Table size="small" rowKey="id" loading={!data} dataSource={data?.promotions} columns={promotionColumns} pagination={false} />
      </Card>
    </>
  );
}
