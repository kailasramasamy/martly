import { useMemo, useState } from "react";
import { List } from "@refinedev/antd";
import { Alert, Button, Card, Empty, Input, InputNumber, Segmented, Space, Spin, Typography } from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { StoreSelect } from "../../components/StoreSelect";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { AisleCard } from "./aisle-card";
import { useLooseStaples } from "./api";
import { visibleAisles, type StapleFilter } from "./drafts";

/** Unbranded rice, dal, atta and spices: a price per size, started from suggestions; saved sizes go on sale and lead their aisles */
export const LooseStaplesPage = () => {
  const [storeId, setStoreId] = useState<string>();
  const [filter, setFilter] = useState<StapleFilter>("TO_PRICE");
  const [q, setQ] = useState("");
  const staples = useLooseStaples(storeId);
  const aisles = useMemo(() => visibleAisles(staples.aisles, filter, q), [staples.aisles, filter, q]);
  const totals = useMemo(
    () => new Map(staples.aisles.map((a) => [a.subcategoryId, { listed: a.items.filter((i) => i.listed?.isActive).length, sizes: a.items.length }])),
    [staples.aisles],
  );

  const listed = staples.all.filter((i) => i.listed).length;
  const options = [
    { value: "TO_PRICE", label: `To price (${staples.all.length - listed})` },
    { value: "LISTED", label: `On sale (${listed})` },
    { value: "ALL", label: "All" },
  ];
  const count = staples.changes.length;

  return (
    <List title="Loose staples" headerButtons={<StoreSelect value={storeId} onChange={setStoreId} style={{ width: 240 }} />}>
      <Typography.Paragraph type="secondary">Price each size of your unbranded staples. Saved sizes go on sale and lead their aisles.</Typography.Paragraph>
      {!storeId ? (
        <Alert type="info" showIcon message="Pick a store to price its loose staples" />
      ) : (
        <>
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space wrap>
              <DebouncedSearch placeholder="Search rice, dal, atta" onSearch={setQ} style={{ width: 260 }} />
              <Segmented options={options} value={filter} onChange={(v) => setFilter(v as StapleFilter)} />
              {filter !== "LISTED" && aisles.length > 0 && (
                <Button type="link" onClick={() => staples.fillSuggested(aisles.flatMap((a) => a.items))}>Fill every suggested price below</Button>
              )}
            </Space>
          </Card>
          <Spin spinning={staples.loading}>
            {aisles.length === 0 && !staples.loading ? (
              <Empty description={filter === "LISTED" ? "Nothing on sale yet" : "All priced"} />
            ) : (
              aisles.map((aisle) => (
                <AisleCard key={aisle.subcategoryId} aisle={aisle} total={totals.get(aisle.subcategoryId) ?? { listed: 0, sizes: aisle.items.length }} drafts={staples.drafts} onPrice={staples.setPrice} onFill={staples.fillSuggested} />
              ))
            )}
          </Spin>
          <Card size="small" style={{ position: "sticky", bottom: 0, zIndex: 1 }}>
            <Space wrap>
              <Typography.Text type="secondary">New stock per newly listed size</Typography.Text>
              <InputNumber min={0} max={99999} precision={0} value={Number(staples.openingStock)} onChange={(v) => staples.setOpeningStock(String(v ?? 0))} style={{ width: 100 }} />
              <Button type="primary" icon={<SaveOutlined />} loading={staples.saving} disabled={count === 0} onClick={staples.save}>
                {count ? `Save ${count} ${count === 1 ? "price" : "prices"}` : "Type prices to save"}
              </Button>
            </Space>
          </Card>
        </>
      )}
    </List>
  );
};
