import { useCallback, useEffect, useState } from "react";
import { List } from "@refinedev/antd";
import { Button, Space, Typography } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import type { StockCheckBrand, StockCheckSummary } from "@martly/shared/types";
import { StoreSelect } from "../../components/StoreSelect";
import { useStockCheckActions, useStockGet } from "./api";
import { BrandsTable, type BrandTab } from "./brands-table";
import { DepartmentsTable } from "./departments-table";
import { SizesDrawer } from "./sizes-drawer";
import { SummaryPanel, type DepartmentFocus } from "./summary-panel";

/** Confirm which listings the store really carries, by department, then brand, then size */
export const StockCheckPage = () => {
  const [storeId, setStoreId] = useState<string>();
  const [departmentId, setDepartmentId] = useState<string>();
  const [sizes, setSizes] = useState<{ brand: StockCheckBrand; tab: BrandTab } | null>(null);
  const [version, setVersion] = useState(0);
  const [focus, setFocus] = useState<DepartmentFocus | null>(null);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);
  const actions = useStockCheckActions(storeId, refresh);
  const { data: summary, loading } = useStockGet<StockCheckSummary>("summary", storeId ? { storeId } : null, version);

  useEffect(() => {
    setDepartmentId(undefined);
    setFocus(null);
  }, [storeId]);

  const department = summary?.departments.find((d) => d.id === departmentId);

  return (
    <List title="Stock check" headerButtons={<StoreSelect value={storeId} onChange={setStoreId} style={{ width: 240 }} />}>
      <Typography.Paragraph type="secondary">Onboarding guessed your range. Confirm what the store really carries; customers only see what you confirm.</Typography.Paragraph>
      <SummaryPanel summary={summary} focus={focus} onFocus={(f) => { setFocus(f); setDepartmentId(undefined); }} />
      {storeId && department ? (
        <div style={{ marginTop: 24 }}>
          <Space style={{ marginBottom: 12 }}>
            <Button icon={<ArrowLeftOutlined />} onClick={() => setDepartmentId(undefined)}>All departments</Button>
            <Typography.Title level={4} style={{ margin: 0 }}>{department.name}</Typography.Title>
          </Space>
          <BrandsTable storeId={storeId} initialTab={focus ?? undefined} department={department} version={version} actions={actions} onSizes={(brand, tab) => setSizes({ brand, tab })} />
          <SizesDrawer storeId={storeId} departmentId={department.id} brand={sizes?.brand ?? null} tab={sizes?.tab ?? "all"} version={version} actions={actions} onClose={() => setSizes(null)} />
        </div>
      ) : (
        <DepartmentsTable departments={(summary?.departments ?? []).filter((d) => !focus || d[focus] > 0)} loading={loading && !summary} actions={actions} onPick={setDepartmentId} />
      )}
    </List>
  );
};
