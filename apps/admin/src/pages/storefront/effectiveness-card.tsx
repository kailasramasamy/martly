import { useEffect, useState } from "react";
import { Card, Empty, Segmented, Space, Statistic, Table, message } from "antd";
import type { StorefrontEffectiveness } from "@martly/shared/types";

import { axiosInstance } from "../../providers/data-provider";
import { ReadableSection } from "../../components/ReadableSection";

const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

function StatRow({ data }: { data: StorefrontEffectiveness }) {
  const { buyGet, discount, coupons } = data.offers;
  return (
    <Space size={32} wrap>
      <Statistic title="Revenue" value={money(data.revenue)} />
      <Statistic title="From Home" value={`${data.homeRevenueShare}%`} />
      <Statistic title="Buy X get Y" value={money(buyGet.revenue)} suffix={`· ${buyGet.units} units`} />
      <Statistic title="Discounts" value={money(discount.revenue)} suffix={`· ${discount.units} units`} />
      <Statistic title="Coupons" value={coupons.redemptions} suffix={`· ${money(coupons.discount)} off`} />
    </Space>
  );
}

function Tables({ data }: { data: StorefrontEffectiveness }) {
  return (
    <>
      <Card title="Home sections" size="small">
        <Table rowKey="sectionId" size="small" pagination={false} dataSource={data.sections} locale={{ emptyText: <Empty description="No section activity yet" /> }}
          columns={[
            { title: "Section", render: (_, r) => r.title ?? r.sectionType },
            { title: "Views", dataIndex: "views" },
            { title: "Taps", dataIndex: "taps" },
            { title: "Cart adds", dataIndex: "cartAdds" },
            { title: "Orders", dataIndex: "orders" },
            { title: "Revenue", dataIndex: "revenue", render: money },
          ]} />
      </Card>
      <Card title="Banners" size="small">
        <Table rowKey="bannerId" size="small" pagination={false} dataSource={data.banners} locale={{ emptyText: <Empty description="No banner activity yet" /> }}
          columns={[
            { title: "Banner", render: (_, r) => r.title ?? "Untitled" },
            { title: "Views", dataIndex: "views" },
            { title: "Taps", dataIndex: "taps" },
            { title: "CTR", dataIndex: "ctr", render: (v: number) => `${v}%` },
          ]} />
      </Card>
    </>
  );
}

/** What Home, offers and banners earned over the last 7 or 30 days */
export function EffectivenessCard({ storeId }: { storeId: string }) {
  const [days, setDays] = useState<7 | 30>(7);
  const [data, setData] = useState<StorefrontEffectiveness | null>(null);

  useEffect(() => {
    setData(null);
    axiosInstance.get("/storefront/effectiveness", { params: { storeId, days } })
      .then((res) => setData(res.data.data))
      .catch((err) => message.error(err.response?.data?.message ?? "Couldn't load results"));
  }, [storeId, days]);

  return (
    <Card title="What's working" size="small" loading={!data} extra={<Segmented<7 | 30> value={days} onChange={setDays} options={[{ value: 7, label: "7 days" }, { value: 30, label: "30 days" }]} />}>
      {data && (
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <ReadableSection><StatRow data={data} /></ReadableSection>
          <Tables data={data} />
        </Space>
      )}
    </Card>
  );
}
