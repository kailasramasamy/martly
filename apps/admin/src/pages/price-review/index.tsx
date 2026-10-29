import { useCallback, useEffect, useState } from "react";
import { useGetIdentity } from "@refinedev/core";
import { List } from "@refinedev/antd";
import { App, Card, Empty, Result, Segmented, Select, Space, Tabs, Tag, Typography } from "antd";
import { isAxiosError } from "axios";
import type { PriceReviewGroup, PriceReviewSummary } from "@martly/shared/types";
import { hasPermission } from "@martly/shared/permissions";
import { axiosInstance } from "../../providers/data-provider";
import { StoreSelect } from "../../components/StoreSelect";
import { DebouncedSearch } from "../../components/DebouncedSearch";
import { DEFAULT_FILTERS, useApiList, usePriceReviewActions, type ItemFilters } from "./api";
import { GroupsTable, type GroupBy } from "./groups-table";
import { ItemsTable } from "./items-table";
import { StockCheckBanner } from "./stock-check-banner";
import { SummaryPanel } from "./summary-panel";

type Tab = "products" | GroupBy;

const AllDone = () => <Result status="success" title="All prices reviewed" subTitle="Every listing at this store has a settled price." />;

/** Settle the prices a store was onboarded with: keep, change or hide, best sellers first */
export const PriceReviewPage = () => {
  const { message } = App.useApp();
  const { data: identity } = useGetIdentity<{ role: string; permissions?: string[] }>();
  const canHide = identity?.role === "SUPER_ADMIN" || hasPermission(identity?.permissions, "LISTING_AVAILABILITY");
  const [storeId, setStoreId] = useState<string>();
  const [tab, setTab] = useState<Tab>("products");
  const [filters, setFilters] = useState<ItemFilters>(DEFAULT_FILTERS);
  const [brandQ, setBrandQ] = useState("");
  const [summary, setSummary] = useState<PriceReviewSummary | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;
    axiosInstance
      .get("/price-review/summary", { params: { storeId } })
      .then(({ data }) => !cancelled && setSummary(data.data))
      .catch((err) => {
        if (!isAxiosError(err)) throw err;
        message.error("Failed to load the price review summary");
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, version, message]);

  useEffect(() => {
    setSummary(null);
    setFilters(DEFAULT_FILTERS);
  }, [storeId]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const actions = usePriceReviewActions(storeId, refresh);
  const brands = useApiList<PriceReviewGroup>("groups", storeId ? { storeId, by: "brand", status: "all", q: brandQ || undefined, pageSize: 100 } : null);
  const change = (patch: Partial<ItemFilters>) => setFilters((f) => ({ ...f, ...patch }));

  const review = (group: PriceReviewGroup) => {
    change(tab === "brand"
      ? { brand: { value: group.id, label: group.name }, subcategory: undefined }
      : { subcategory: { id: group.id, name: group.name }, brand: undefined });
    setTab("products");
  };

  const allDone = summary?.pending === 0 && summary.total > 0;
  const emptyText = allDone && filters.status === "pending" ? <AllDone /> : "Nothing matches these filters";

  const productFilters = (
    <Card size="small" style={{ marginBottom: 12 }}>
      <Space wrap>
        <DebouncedSearch placeholder="Search products" onSearch={(q) => change({ q })} style={{ width: 260 }} />
        <Select
          showSearch
          allowClear
          labelInValue
          filterOption={false}
          placeholder="Brand"
          style={{ width: 200 }}
          value={filters.brand}
          loading={brands.loading}
          options={brands.rows.map((b) => ({ value: b.id, label: b.name }))}
          onSearch={setBrandQ}
          onChange={(brand) => change({ brand: brand ?? undefined })}
        />
        {filters.subcategory && <Tag closable onClose={() => change({ subcategory: undefined })}>Aisle: {filters.subcategory.name}</Tag>}
        <Segmented
          options={[{ label: "Pending", value: "pending" }, { label: "Reviewed", value: "reviewed" }, { label: "Not sold", value: "notCarried" }, { label: "All", value: "all" }]}
          value={filters.status}
          onChange={(v) => change({ status: v as ItemFilters["status"], outcome: undefined })}
        />
        <Segmented options={[{ label: "Best sellers", value: "priority" }, { label: "A-Z", value: "name" }]} value={filters.sort} onChange={(v) => change({ sort: v as ItemFilters["sort"] })} />
      </Space>
    </Card>
  );

  const groupTable = (by: GroupBy) => (
    <GroupsTable by={by} storeId={storeId} departmentId={filters.departmentId} version={version} actions={actions} canHide={canHide} emptyText={allDone ? <AllDone /> : "Nothing here"} onReview={review} />
  );

  return (
    <List title="Price review" headerButtons={<StoreSelect value={storeId} onChange={setStoreId} style={{ width: 240 }} />}>
      <Typography.Paragraph type="secondary">Settle the prices your store was onboarded with. Best sellers first.</Typography.Paragraph>
      {!storeId ? (
        <Empty description="Select a store to review its prices" />
      ) : (
        <>
          <StockCheckBanner storeId={storeId} version={version} />
          <SummaryPanel summary={summary} filters={filters} onFilters={change} />
          <Tabs
            activeKey={tab}
            onChange={(k) => setTab(k as Tab)}
            items={[
              {
                key: "products",
                label: "Products",
                children: (
                  <>
                    {productFilters}
                    <ItemsTable storeId={storeId} filters={filters} version={version} actions={actions} canHide={canHide} emptyText={emptyText} />
                  </>
                ),
              },
              { key: "brand", label: "By brand", children: groupTable("brand") },
              { key: "subcategory", label: "By aisle", children: groupTable("subcategory") },
            ]}
          />
        </>
      )}
    </List>
  );
};
